import asyncio
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from backend.app.models.database import Generation
from backend.app.providers.manager import provider_manager
from backend.app.providers.music.base import BaseMusicProvider
from backend.app.providers.music.base import MusicGenerationRequest as MusicReq
from backend.app.repositories.generation import generation_repository
from backend.app.services.llm_service import llm_service
from backend.app.services.storage import storage_service

logger = logging.getLogger(__name__)

_GENERATION_TIMEOUT = 1800  # 30 minutes


def _build_music_prompt(request: MusicReq) -> str:
    """Compose a rich text prompt from structured request fields."""
    parts: list[str] = []

    if request.prompt:
        parts.append(request.prompt)
    if request.genre:
        parts.append(f"{request.genre} style")
    if request.mood:
        parts.append(f"{request.mood} mood")
    if request.tempo:
        parts.append(f"{request.tempo} BPM")
    if request.musical_key:
        parts.append(f"in the key of {request.musical_key}")
    if request.instruments:
        parts.append(f"featuring {', '.join(request.instruments)}")
    if request.instrumental:
        parts.append("instrumental, no vocals")

    return ", ".join(parts) if parts else "instrumental music"


_running_tasks: dict[str, asyncio.Task] = {}
_generation_semaphore = asyncio.Semaphore(2)


class GenerationService:
    def __init__(self) -> None:
        self._repo = generation_repository

    async def create_generation(
        self,
        prompt: str,
        duration: float = 30.0,
        genre: str | None = None,
        mood: str | None = None,
        lyrics: str | None = None,
        title: str | None = None,
        tempo: int | None = None,
        musical_key: str | None = None,
        instruments: list[str] | None = None,
        language: str = "en",
        instrumental: bool = False,
        enhance_prompt: bool = True,
        generate_lyrics: bool = False,
        generate_cover: bool = True,
        parent_id: int | None = None,
        parent_type: str | None = None,
    ) -> Generation:
        task_id = uuid.uuid4().hex
        llm_provider_name: str | None = None
        enhanced_prompt: str | None = None

        # LLM: enhance prompt (via service, not provider directly)
        if enhance_prompt:
            try:
                enhanced_prompt = await llm_service.enhance_prompt(
                    prompt, genre=genre, mood=mood
                )
                llm_provider_name = "llm"
            except Exception:
                logger.exception("Prompt enhancement failed")

        # LLM: generate lyrics (via service)
        if generate_lyrics and not lyrics:
            try:
                lyrics = await llm_service.generate_lyrics(
                    prompt, genre=genre, mood=mood, language=language
                )
                if not llm_provider_name:
                    llm_provider_name = "llm"
            except Exception:
                logger.exception("Lyrics generation failed")

        # Resolve music provider
        music_req = MusicReq(
            prompt=enhanced_prompt or prompt,
            lyrics=lyrics,
            duration=duration,
            genre=genre,
            mood=mood,
            tempo=tempo,
            musical_key=musical_key,
            instruments=instruments,
            instrumental=instrumental,
        )
        music_provider = provider_manager.get_music_provider()
        music_provider_name = music_provider.config.name

        gen = await self._repo.create(
            task_id=task_id,
            status="pending",
            prompt=prompt,
            enhanced_prompt=enhanced_prompt,
            lyrics=lyrics,
            genre=genre,
            mood=mood,
            duration=duration,
            title=title,
            tempo=tempo,
            musical_key=musical_key,
            instruments=instruments,
            language=language,
            instrumental=1 if instrumental else 0,
            llm_provider=llm_provider_name,
            music_provider=music_provider_name,
            parent_id=parent_id,
            parent_type=parent_type,
        )

        # Dispatch generation as an async background task
        task = asyncio.create_task(
            self._run_generation_background(
                gen.task_id, music_req, music_provider, generate_cover,
            )
        )
        _running_tasks[gen.task_id] = task
        task.add_done_callback(lambda _t: _running_tasks.pop(gen.task_id, None))

        return gen

    async def extend_generation(
        self,
        generation_id: int,
        prompt: str | None = None,
        lyrics: str | None = None,
        duration: float = 30.0,
    ) -> Generation:
        """Create a new generation that extends an existing one."""
        parent = await self._repo.get_by_id(generation_id)
        if parent is None:
            raise ValueError(f"Generation {generation_id} not found")

        return await self.create_generation(
            prompt=prompt or (parent.prompt + " (continuation)"),
            duration=duration,
            genre=parent.genre,
            mood=parent.mood,
            lyrics=lyrics or parent.lyrics,
            title=parent.title,
            tempo=parent.tempo,
            musical_key=parent.musical_key,
            instruments=parent.instruments,
            language=parent.language or "en",
            instrumental=bool(parent.instrumental),
            enhance_prompt=True,
            generate_lyrics=False,
            generate_cover=True,
            parent_id=parent.id,
            parent_type="extend",
        )

    async def remix_generation(
        self,
        generation_id: int,
        genre: str | None = None,
        mood: str | None = None,
        tempo: int | None = None,
        musical_key: str | None = None,
        instruments: list[str] | None = None,
        prompt: str | None = None,
    ) -> Generation:
        """Create a remix/variation of an existing generation."""
        parent = await self._repo.get_by_id(generation_id)
        if parent is None:
            raise ValueError(f"Generation {generation_id} not found")

        return await self.create_generation(
            prompt=prompt or parent.prompt,
            duration=parent.duration or 30.0,
            genre=genre or parent.genre,
            mood=mood or parent.mood,
            lyrics=parent.lyrics,
            title=parent.title,
            tempo=tempo or parent.tempo,
            musical_key=musical_key or parent.musical_key,
            instruments=instruments or parent.instruments,
            language=parent.language or "en",
            instrumental=bool(parent.instrumental),
            enhance_prompt=True,
            generate_lyrics=False,
            generate_cover=True,
            parent_id=parent.id,
            parent_type="remix",
        )

    async def toggle_like(self, generation_id: int) -> bool:
        """Toggle like status for a generation. Returns new is_liked state."""
        gen = await self._repo.toggle_like(generation_id)
        if gen is None:
            raise ValueError(f"Generation {generation_id} not found")
        return bool(gen.is_liked)

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a running generation task. Returns True if cancelled."""
        task = _running_tasks.get(task_id)
        if task is None:
            return False
        task.cancel()
        return True

    async def _run_generation_background(
        self,
        task_id: str,
        music_req: MusicReq,
        music_provider: "BaseMusicProvider",
        generate_cover: bool = True,
    ) -> None:
        """Run music generation in background and update DB record via repository."""
        async with _generation_semaphore:
            try:
                await asyncio.wait_for(
                    self._run_generation(
                        task_id, music_req, music_provider, generate_cover,
                    ),
                    timeout=_GENERATION_TIMEOUT,
                )
            except TimeoutError:
                logger.error("Generation timed out: task_id=%s", task_id)
                try:
                    await self._repo.update_status(
                        task_id,
                        "failed",
                        error_message="Generation timed out",
                        progress=0,
                        progress_message="Generation timed out",
                    )
                except Exception:
                    logger.exception("Failed to mark timed-out generation: %s", task_id)
            except asyncio.CancelledError:
                logger.info("Generation cancelled: task_id=%s", task_id)
                try:
                    await self._repo.update_status(
                        task_id,
                        "failed",
                        error_message="Cancelled by user",
                        progress=0,
                        progress_message="Cancelled",
                    )
                except Exception:
                    logger.exception("Failed to mark cancelled generation: %s", task_id)

    async def _run_generation(
        self,
        task_id: str,
        music_req: MusicReq,
        music_provider: "BaseMusicProvider",
        generate_cover: bool = True,
    ) -> None:
        """Core generation logic extracted for timeout wrapping."""
        try:
            await self._repo.update_status(
                task_id,
                "processing",
                progress=10,
                progress_message="Starting generation...",
            )

            # Build the full text prompt from structured fields before
            # handing off to the provider (prompt construction is business
            # logic, not a provider concern).
            music_req = music_req.model_copy(
                update={"prompt": _build_music_prompt(music_req)}
            )

            await self._repo.update_status(
                task_id,
                "processing",
                progress=30,
                progress_message="Generating audio...",
            )

            response = await music_provider.generate(music_req)

            # Persist audio bytes to disk via storage service.
            if response.audio_data:
                gen_record = await self._repo.get_by_task_id(task_id)
                audio_meta = {
                    "title": (gen_record.title if gen_record and gen_record.title
                              else music_req.prompt[:50]),
                    "artist": "HikariWave AI",
                    "genre": music_req.genre or "",
                    "comment": music_req.prompt,
                    "album": "HikariWave Generations",
                }
                filename = await storage_service.save_audio_with_metadata(
                    response.audio_data, response.format, audio_meta
                )
            else:
                filename = Path(response.audio_path).name

            if generate_cover:
                await self._repo.update_status(
                    task_id,
                    "processing",
                    progress=70,
                    progress_message="Generating cover art...",
                )

            await self._repo.update_status(
                task_id,
                "completed",
                audio_path=filename,
                audio_format=response.format,
                actual_duration=response.duration,
                progress=100,
                progress_message="Complete!",
                completed_at=datetime.now(UTC),
            )
            logger.info("Generation completed: task_id=%s", task_id)

            # Cover art generation (optional, non-blocking)
            if generate_cover:
                gen = await self._repo.get_by_task_id(task_id)
                if gen:
                    await self._generate_cover_art(task_id, gen)

        except Exception as exc:
            logger.exception("Background generation failed: task_id=%s", task_id)
            try:
                await self._repo.update_status(
                    task_id,
                    "failed",
                    error_message=(str(exc) or type(exc).__name__)[:500],
                    progress=0,
                    progress_message="Generation failed",
                )
            except Exception:
                logger.exception("Failed to mark generation as failed: %s", task_id)

    async def _generate_cover_art(self, task_id: str, gen: Generation) -> None:
        """Generate cover art for a completed generation. Never fails the generation."""
        try:
            # Generate cover art prompt via LLM service
            cover_prompt = await llm_service.generate_cover_prompt(
                title=gen.title,
                genre=gen.genre,
                mood=gen.mood,
                lyrics=gen.lyrics,
            )

            # Generate the image via LLM provider's image endpoint
            image_path = await llm_service.generate_cover_image(cover_prompt)

            # Update the generation record with cover art info
            await self._repo.update_cover_art(
                task_id, Path(image_path).name, cover_prompt
            )
            logger.info("Cover art saved for task_id=%s", task_id)

        except Exception:
            logger.exception(
                "Cover art generation failed for task_id=%s (non-fatal)", task_id
            )

    async def generate_cover_for_existing(
        self,
        generation_id: int,
        title: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        lyrics: str | None = None,
    ) -> tuple[str, str]:
        """Generate cover art for an existing generation. Returns (path, prompt)."""
        gen = await self._repo.get_by_id(generation_id)
        if gen is None:
            raise ValueError(f"Generation {generation_id} not found")

        # Use provided metadata or fall back to generation record
        art_title = title or gen.title
        art_genre = genre or gen.genre
        art_mood = mood or gen.mood
        art_lyrics = lyrics or gen.lyrics

        # Generate cover art prompt via LLM service
        cover_prompt = await llm_service.generate_cover_prompt(
            title=art_title,
            genre=art_genre,
            mood=art_mood,
            lyrics=art_lyrics,
        )

        # Generate the image via LLM provider's image endpoint
        image_path = await llm_service.generate_cover_image(cover_prompt)

        # Update generation record
        cover_basename = Path(image_path).name
        await self._repo.update_cover_art_by_id(
            generation_id, cover_basename, cover_prompt
        )

        return cover_basename, cover_prompt

    async def get_generation(self, generation_id: int) -> Generation | None:
        return await self._repo.get_by_id(generation_id)

    async def get_by_task_id(self, task_id: str) -> Generation | None:
        return await self._repo.get_by_task_id(task_id)

    async def list_generations(
        self,
        offset: int = 0,
        limit: int = 50,
        search: str | None = None,
        is_liked: bool | None = None,
        genre: str | None = None,
        mood: str | None = None,
        status: str | None = None,
        sort: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[Generation], int]:
        return await self._repo.list_all(
            offset=offset,
            limit=limit,
            search=search,
            is_liked=is_liked,
            genre=genre,
            mood=mood,
            status=status,
            sort=sort,
            sort_dir=sort_dir,
        )

    async def delete_generation(self, generation_id: int) -> bool:
        gen = await self._repo.get_by_id(generation_id)
        if gen is None:
            return False
        # Clean up files
        if gen.audio_path:
            await storage_service.delete_audio(Path(gen.audio_path).name)
        if gen.cover_art_path:
            await storage_service.delete_cover(Path(gen.cover_art_path).name)
        return await self._repo.delete(generation_id)


generation_service = GenerationService()
