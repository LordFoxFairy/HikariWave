import asyncio
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from backend.app.models.database import Generation
from backend.app.providers.manager import provider_manager
from backend.app.providers.music.base import MusicGenerationRequest as MusicReq
from backend.app.repositories.generation import generation_repository
from backend.app.services.storage import storage_service

logger = logging.getLogger(__name__)


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
    ) -> Generation:
        task_id = uuid.uuid4().hex
        llm_provider_name: str | None = None
        enhanced_prompt: str | None = None

        # LLM: enhance prompt
        if enhance_prompt:
            try:
                provider, model = provider_manager.get_llm_provider("enhancement")
                enhanced_prompt = await provider.enhance_prompt(
                    prompt, model, genre=genre, mood=mood
                )
                llm_provider_name = f"{provider.config.name}:{model}"
            except Exception:
                logger.exception("Prompt enhancement failed")

        # LLM: generate lyrics
        if generate_lyrics and not lyrics:
            try:
                provider, model = provider_manager.get_llm_provider("lyrics")
                lyrics = await provider.generate_lyrics(
                    prompt, model, genre=genre, mood=mood, language=language
                )
                if not llm_provider_name:
                    llm_provider_name = f"{provider.config.name}:{model}"
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
        music_provider = provider_manager.get_music_provider(music_req)

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
            music_provider=music_provider.config.name,
        )

        # Dispatch generation as an async background task
        asyncio.create_task(
            self._run_generation_background(gen.task_id, music_req, generate_cover)
        )

        return gen

    async def _run_generation_background(
        self,
        task_id: str,
        music_req: MusicReq,
        generate_cover: bool = True,
    ) -> None:
        """Run music generation in background and update DB record via repository."""
        try:
            await self._repo.update_status(task_id, "processing", progress=10)

            provider = provider_manager.get_music_provider(music_req)
            response = await provider.generate(music_req)

            await self._repo.update_status(
                task_id,
                "completed",
                audio_path=response.audio_path,
                audio_format=response.format,
                actual_duration=response.duration,
                progress=100,
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
                    error_message=str(exc)[:500],
                    progress=0,
                )
            except Exception:
                logger.exception("Failed to mark generation as failed: %s", task_id)

    async def _generate_cover_art(self, task_id: str, gen: Generation) -> None:
        """Generate cover art for a completed generation. Never fails the generation."""
        from backend.app.providers.image.base import ImageGenerationRequest

        try:
            image_provider = provider_manager.get_image_provider()
            if image_provider is None:
                logger.debug("No image provider configured, skipping cover art")
                return

            # Generate cover art prompt via LLM
            llm_provider, llm_model = provider_manager.get_llm_provider("cover_art")
            cover_prompt = await llm_provider.generate_cover_prompt(
                model=llm_model,
                title=gen.title,
                genre=gen.genre,
                mood=gen.mood,
                lyrics=gen.lyrics,
            )

            # Generate the image
            image_req = ImageGenerationRequest(
                prompt=cover_prompt,
                width=image_provider.config.default_width,
                height=image_provider.config.default_height,
            )
            image_resp = await image_provider.generate(image_req)

            # Update the generation record with cover art info
            await self._repo.update_cover_art(
                task_id, image_resp.image_path, cover_prompt
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
        from backend.app.providers.image.base import ImageGenerationRequest

        gen = await self._repo.get_by_id(generation_id)
        if gen is None:
            raise ValueError(f"Generation {generation_id} not found")

        image_provider = provider_manager.get_image_provider()
        if image_provider is None:
            raise RuntimeError("No image provider configured")

        # Use provided metadata or fall back to generation record
        art_title = title or gen.title
        art_genre = genre or gen.genre
        art_mood = mood or gen.mood
        art_lyrics = lyrics or gen.lyrics

        # Generate cover art prompt via LLM
        llm_provider, llm_model = provider_manager.get_llm_provider("cover_art")
        cover_prompt = await llm_provider.generate_cover_prompt(
            model=llm_model,
            title=art_title,
            genre=art_genre,
            mood=art_mood,
            lyrics=art_lyrics,
        )

        # Generate the image
        image_req = ImageGenerationRequest(
            prompt=cover_prompt,
            width=image_provider.config.default_width,
            height=image_provider.config.default_height,
        )
        image_resp = await image_provider.generate(image_req)

        # Update generation record
        await self._repo.update_cover_art_by_id(
            generation_id, image_resp.image_path, cover_prompt
        )

        return image_resp.image_path, cover_prompt

    async def get_generation(self, generation_id: int) -> Generation | None:
        return await self._repo.get_by_id(generation_id)

    async def get_by_task_id(self, task_id: str) -> Generation | None:
        return await self._repo.get_by_task_id(task_id)

    async def list_generations(
        self, offset: int = 0, limit: int = 50
    ) -> tuple[list[Generation], int]:
        return await self._repo.list_all(offset=offset, limit=limit)

    async def delete_generation(self, generation_id: int) -> bool:
        gen = await self._repo.get_by_id(generation_id)
        if gen is None:
            return False
        # Clean up files
        if gen.audio_path:
            storage_service.delete_audio(Path(gen.audio_path).name)
        if gen.cover_art_path:
            storage_service.delete_cover(Path(gen.cover_art_path).name)
        return await self._repo.delete(generation_id)


generation_service = GenerationService()
