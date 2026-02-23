import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.providers.manager import provider_manager
from backend.app.schemas.generation import (
    CoverArtRequest,
    CoverArtResponse,
    EnhancedPromptResponse,
    LyricsGenerationRequest,
    LyricsResponse,
    MusicGenerationRequest,
    PromptEnhancementRequest,
    StyleSuggestion,
    StyleSuggestionRequest,
    StyleSuggestionResponse,
    TaskResponse,
    TitleGenerationRequest,
    TitleGenerationResponse,
)
from backend.app.services.generation import generation_service

logger = logging.getLogger(__name__)

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
        title=req.title,
        tempo=req.tempo,
        musical_key=req.musical_key,
        instruments=req.instruments,
        language=req.language,
        instrumental=req.instrumental,
        enhance_prompt=req.enhance_prompt,
        generate_lyrics=req.generate_lyrics,
        generate_cover=req.generate_cover,
    )
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
    # Try to include style suggestions alongside lyrics
    suggestions = None
    try:
        suggestion_provider, suggestion_model = provider_manager.get_llm_provider(
            "suggestion"
        )
        raw = await suggestion_provider.suggest_style(req.prompt, suggestion_model)
        suggestions = StyleSuggestion(**raw)
    except Exception:
        logger.debug("Style suggestion alongside lyrics failed, skipping")

    return LyricsResponse(
        lyrics=lyrics,
        genre=req.genre,
        mood=req.mood,
        suggestions=suggestions,
    )


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


@router.post("/suggest-style", response_model=StyleSuggestionResponse)
async def suggest_style(req: StyleSuggestionRequest):
    provider, model = provider_manager.get_llm_provider("suggestion")
    raw = await provider.suggest_style(req.prompt, model)
    suggestions = StyleSuggestion(**raw)
    return StyleSuggestionResponse(suggestions=suggestions)


@router.post("/title", response_model=TitleGenerationResponse)
async def generate_title(req: TitleGenerationRequest):
    provider, model = provider_manager.get_llm_provider("suggestion")
    title = await provider.generate_title(
        model=model,
        lyrics=req.lyrics,
        genre=req.genre,
        mood=req.mood,
        prompt=req.prompt,
    )
    return TitleGenerationResponse(title=title)


@router.post("/cover-art", response_model=CoverArtResponse)
async def generate_cover_art(
    req: CoverArtRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        path, prompt_used = await generation_service.generate_cover_for_existing(
            db=db,
            generation_id=req.generation_id,
            title=req.title,
            genre=req.genre,
            mood=req.mood,
            lyrics=req.lyrics,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return CoverArtResponse(cover_art_path=path, prompt_used=prompt_used)
