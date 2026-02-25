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
from backend.app.utils.lrc import lrc_to_plain
from backend.app.services.storage import storage_service

logger = logging.getLogger(__name__)

_GENERATION_TIMEOUT = 1800  # 30 minutes


def _build_fallback_caption(
    prompt: str,
    genre: str | None = None,
    mood: str | None = None,
    instruments: list[str] | None = None,
    instrumental: bool = False,
) -> str:
    """Build a music caption from structured fields when LLM enhancement is unavailable.

    This is a model-agnostic fallback — it produces a descriptive text
    caption suitable for any music generation model.
    """
    sentences: list[str] = []
    if prompt:
        sentences.append(prompt)

    detail_parts: list[str] = []
    if genre:
        detail_parts.append(genre.lower())
    if mood:
        detail_parts.append(f"{mood.lower()} mood")
    if instruments:
        detail_parts.append(f"featuring {', '.join(instruments)}")
    if instrumental:
        detail_parts.append("purely instrumental, no vocals")

    if detail_parts:
        sentences.append(", ".join(detail_parts).capitalize())

    if not sentences:
        return "A polished, well-produced music track with clear mix and dynamic range"

    return ". ".join(sentences)


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
        seed: int | None = None,
        enhance_prompt: bool = True,
        generate_lyrics: bool = False,
        generate_cover: bool = True,
        parent_id: int | None = None,
        parent_type: str | None = None,
        # Style transfer / Cover / Repaint
        task_type: str = "text2music",
        reference_audio_path: str | None = None,
        src_audio_path: str | None = None,
        audio_cover_strength: float = 1.0,
        cover_noise_strength: float = 0.0,
        repainting_start: float = 0.0,
        repainting_end: float | None = None,
    ) -> Generation:
        task_id = uuid.uuid4().hex
        llm_provider_name: str | None = None
        enhanced_prompt: str | None = None

        # LLM: enhance prompt (via service, not provider directly)
        if enhance_prompt:
            try:
                enhanced_prompt = await llm_service.enhance_prompt(
                    prompt, genre=genre, mood=mood,
                    instruments=instruments, language=language,
                    instrumental=instrumental,
                )
                llm_provider_name = "llm"
            except Exception:
                logger.exception("Prompt enhancement failed")

        # LLM: generate lyrics when none provided
        if generate_lyrics and not lyrics:
            try:
                lyrics = await llm_service.generate_lyrics(
                    prompt, genre=genre, mood=mood, language=language,
                    duration=duration,
                    caption=enhanced_prompt,
                )
                if not llm_provider_name:
                    llm_provider_name = "llm"
            except Exception:
                logger.exception("Lyrics generation failed")

        # Format user-provided lyrics into LRC.
        # Skip if: (a) lyrics were just AI-generated above (already LRC),
        #          (b) lyrics came from frontend as LRC (generate_lyrics=True means AI-generated).
        if lyrics and not generate_lyrics:
            try:
                lyrics = await llm_service.format_lyrics(
                    lyrics, duration=duration, language=language,
                )
            except Exception:
                logger.exception("Lyrics formatting failed, using original")

        # Smart defaults: force instrumental mode when no lyrics are available
        if not lyrics and not instrumental:
            instrumental = True
            logger.info("No lyrics available, forcing instrumental mode")

        # When instrumental, ensure no stale lyrics leak through
        if instrumental:
            lyrics = None

        # Build the caption: use LLM-enhanced prompt, or fallback to structured fields
        caption = enhanced_prompt or _build_fallback_caption(
            prompt, genre=genre, mood=mood,
            instruments=instruments, instrumental=instrumental,
        )

        # Provider contract: lyrics in LRC format, provider strips if needed
        music_req = MusicReq(
            prompt=caption,
            lyrics=lyrics,
            duration=duration,
            tempo=tempo,
            musical_key=musical_key,
            instrumental=instrumental,
            seed=seed,
            language=language,
            # Style transfer / Cover / Repaint
            task_type=task_type,
            reference_audio_path=reference_audio_path,
            src_audio_path=src_audio_path,
            audio_cover_strength=audio_cover_strength,
            cover_noise_strength=cover_noise_strength,
            repainting_start=repainting_start,
            repainting_end=repainting_end,
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
                    "genre": gen_record.genre if gen_record and gen_record.genre else "",
                    "comment": music_req.prompt,
                    "album": "HikariWave Generations",
                    "lyrics": lrc_to_plain(gen_record.lyrics) if gen_record and gen_record.lyrics else "",
                    "tempo": str(gen_record.tempo) if gen_record and gen_record.tempo else "",
                    "year": str(datetime.now(UTC).year),
                    "mood": gen_record.mood if gen_record and gen_record.mood else "",
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

            completion_fields: dict = dict(
                audio_path=filename,
                audio_format=response.format,
                actual_duration=response.duration,
                progress=100,
                progress_message="Complete!",
                completed_at=datetime.now(UTC),
            )

            # Lyrics are already in LRC format (with timestamps) from generate_lyrics / format_lyrics.
            # Save both .lrc (original) and .txt (plain text stripped of timestamps).
            gen_record = await self._repo.get_by_task_id(task_id)
            if gen_record and gen_record.lyrics:
                completion_fields["lrc_lyrics"] = gen_record.lyrics
                try:
                    await storage_service.save_lrc(filename, gen_record.lyrics)
                except Exception:
                    logger.exception("Failed to save LRC file (non-fatal)")
                try:
                    await storage_service.save_lyrics(
                        filename, lrc_to_plain(gen_record.lyrics),
                    )
                except Exception:
                    logger.exception("Failed to save lyrics file (non-fatal)")

            await self._repo.update_status(
                task_id,
                "completed",
                **completion_fields,
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

            # Embed cover art into audio file
            gen_updated = await self._repo.get_by_task_id(task_id)
            if gen_updated and gen_updated.audio_path:
                try:
                    await storage_service.embed_cover_art(
                        gen_updated.audio_path, Path(image_path).name
                    )
                except Exception:
                    logger.exception("Failed to embed cover art into audio (non-fatal)")

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
            await storage_service.delete_lyrics(Path(gen.audio_path).name)
        if gen.cover_art_path:
            await storage_service.delete_cover(Path(gen.cover_art_path).name)
        return await self._repo.delete(generation_id)


generation_service = GenerationService()
