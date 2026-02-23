from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.providers.manager import provider_manager
from backend.app.schemas.generation import (
    EnhancedPromptResponse,
    LyricsGenerationRequest,
    LyricsResponse,
    MusicGenerationRequest,
    PromptEnhancementRequest,
    TaskResponse,
)
from backend.app.services.generation import generation_service

router = APIRouter(prefix="/generate", tags=["generate"])


@router.post("/music", response_model=TaskResponse)
async def generate_music(
    req: MusicGenerationRequest,
    db: AsyncSession = Depends(get_db),
):
    gen = await generation_service.create_generation(
        db=db,
        prompt=req.prompt,
        duration=req.duration,
        genre=req.genre,
        mood=req.mood,
        lyrics=req.lyrics,
        enhance_prompt=req.enhance_prompt,
        generate_lyrics=req.generate_lyrics,
    )
    # In production this dispatches to Celery.
    # For MVP we return the task_id immediately.
    return TaskResponse(task_id=gen.task_id, status=gen.status)


@router.post("/lyrics", response_model=LyricsResponse)
async def generate_lyrics(req: LyricsGenerationRequest):
    provider, model = provider_manager.get_llm_provider("lyrics")
    lyrics = await provider.generate_lyrics(
        req.prompt,
        model,
        genre=req.genre,
        mood=req.mood,
        language=req.language,
    )
    return LyricsResponse(lyrics=lyrics, genre=req.genre, mood=req.mood)


@router.post("/enhance-prompt", response_model=EnhancedPromptResponse)
async def enhance_prompt(req: PromptEnhancementRequest):
    provider, model = provider_manager.get_llm_provider("enhancement")
    enhanced = await provider.enhance_prompt(
        req.prompt,
        model,
        genre=req.genre,
        mood=req.mood,
    )
    return EnhancedPromptResponse(
        original_prompt=req.prompt,
        enhanced_prompt=enhanced,
    )
