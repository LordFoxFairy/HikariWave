import asyncio
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.database import Generation
from backend.app.providers.manager import provider_manager
from backend.app.providers.music.base import MusicGenerationRequest as MusicReq

logger = logging.getLogger(__name__)


class GenerationService:
    async def create_generation(
        self,
        db: AsyncSession,
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

        gen = Generation(
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
        db.add(gen)
        await db.flush()

        # Dispatch generation as an async background task
        asyncio.create_task(self._run_generation_background(gen.task_id, music_req))

        return gen

    async def _run_generation_background(
        self, task_id: str, music_req: MusicReq
    ) -> None:
        """Run music generation in background and update DB record."""
        from backend.app.db.session import async_session_factory

        try:
            async with async_session_factory() as db:
                result = await db.execute(
                    select(Generation).where(Generation.task_id == task_id)
                )
                gen = result.scalar_one_or_none()
                if gen is None:
                    logger.error(
                        "Generation not found for background task: %s",
                        task_id,
                    )
                    return

                gen.status = "processing"
                gen.progress = 10
                await db.commit()

                provider = provider_manager.get_music_provider(music_req)
                response = await provider.generate(music_req)

                gen.status = "completed"
                gen.audio_path = response.audio_path
                gen.audio_format = response.format
                gen.actual_duration = response.duration
                gen.progress = 100
                gen.completed_at = datetime.now(UTC)
                await db.commit()
                logger.info("Generation completed: task_id=%s", task_id)

        except Exception as exc:
            logger.exception("Background generation failed: task_id=%s", task_id)
            try:
                async with async_session_factory() as db:
                    result = await db.execute(
                        select(Generation).where(Generation.task_id == task_id)
                    )
                    gen = result.scalar_one_or_none()
                    if gen:
                        gen.status = "failed"
                        gen.error_message = str(exc)[:500]
                        gen.progress = 0
                        await db.commit()
            except Exception:
                logger.exception("Failed to mark generation as failed: %s", task_id)

    async def get_generation(
        self, db: AsyncSession, generation_id: int
    ) -> Generation | None:
        result = await db.execute(
            select(Generation).where(Generation.id == generation_id)
        )
        return result.scalar_one_or_none()

    async def get_by_task_id(self, db: AsyncSession, task_id: str) -> Generation | None:
        result = await db.execute(
            select(Generation).where(Generation.task_id == task_id)
        )
        return result.scalar_one_or_none()

    async def list_generations(
        self,
        db: AsyncSession,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Generation], int]:
        from sqlalchemy import func

        count_q = select(func.count()).select_from(Generation)
        total = (await db.execute(count_q)).scalar() or 0
        q = (
            select(Generation)
            .order_by(Generation.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        return list(rows), total

    async def delete_generation(self, db: AsyncSession, generation_id: int) -> bool:
        gen = await self.get_generation(db, generation_id)
        if gen is None:
            return False
        await db.delete(gen)
        return True


generation_service = GenerationService()
