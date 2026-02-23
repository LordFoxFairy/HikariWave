import logging
import uuid

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
        enhance_prompt: bool = True,
        generate_lyrics: bool = False,
    ) -> Generation:
        task_id = uuid.uuid4().hex
        llm_provider_name: str | None = None
        enhanced_prompt: str | None = None
        generated_lyrics: str | None = None

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
                generated_lyrics = await provider.generate_lyrics(
                    prompt, model, genre=genre, mood=mood
                )
                lyrics = generated_lyrics
            except Exception:
                logger.exception("Lyrics generation failed")

        # Resolve music provider
        music_req = MusicReq(
            prompt=enhanced_prompt or prompt,
            lyrics=lyrics,
            duration=duration,
            genre=genre,
            mood=mood,
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
            llm_provider=llm_provider_name,
            music_provider=music_provider.config.name,
        )
        db.add(gen)
        await db.flush()
        return gen

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
