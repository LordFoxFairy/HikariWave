import logging

from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.dependencies import get_generation_service, get_llm_service
from backend.app.schemas.generation import (
    CoverArtRequest,
    CoverArtResponse,
    EnhancedPromptResponse,
    ExtendRequest,
    LyricsGenerationRequest,
    LyricsResponse,
    MusicGenerationRequest,
    PipelineInfo,
    PipelineListResponse,
    PromptEnhancementRequest,
    RemixRequest,
    StyleSuggestionRequest,
    StyleSuggestionResponse,
    TaskResponse,
    TitleGenerationRequest,
    TitleGenerationResponse,
)
from backend.app.services.generation import GenerationService
from backend.app.services.llm_service import LLMService
from backend.app.services.music import music_inference_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generate"])


@router.get("/pipelines", response_model=PipelineListResponse)
async def list_pipelines():
    items = music_inference_service.list_pipelines()
    return PipelineListResponse(
        pipelines=[PipelineInfo(**p) for p in items],
    )


@router.post("/music", response_model=TaskResponse)
async def generate_music(
    req: MusicGenerationRequest,
    svc: GenerationService = Depends(get_generation_service),
):
    gen = await svc.create_generation(
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
        pipeline=req.pipeline,
    )
    return TaskResponse(task_id=gen.task_id, status=gen.status)


@router.post("/extend", response_model=TaskResponse)
async def extend_generation(
    req: ExtendRequest,
    svc: GenerationService = Depends(get_generation_service),
):
    try:
        gen = await svc.extend_generation(
            generation_id=req.generation_id,
            prompt=req.prompt,
            lyrics=req.lyrics,
            duration=req.duration,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return TaskResponse(task_id=gen.task_id, status=gen.status)


@router.post("/remix", response_model=TaskResponse)
async def remix_generation(
    req: RemixRequest,
    svc: GenerationService = Depends(get_generation_service),
):
    try:
        gen = await svc.remix_generation(
            generation_id=req.generation_id,
            genre=req.genre,
            mood=req.mood,
            tempo=req.tempo,
            musical_key=req.musical_key,
            instruments=req.instruments,
            prompt=req.prompt,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return TaskResponse(task_id=gen.task_id, status=gen.status)


@router.post("/lyrics", response_model=LyricsResponse)
async def generate_lyrics(
    req: LyricsGenerationRequest,
    llm: LLMService = Depends(get_llm_service),
):
    lyrics = await llm.generate_lyrics(
        req.prompt, genre=req.genre, mood=req.mood, language=req.language
    )
    # Try to include style suggestions alongside lyrics
    suggestions = None
    try:
        suggestions = await llm.suggest_style(req.prompt)
    except Exception:
        logger.debug("Style suggestion alongside lyrics failed, skipping")

    return LyricsResponse(
        lyrics=lyrics,
        genre=req.genre,
        mood=req.mood,
        suggestions=suggestions,
    )


@router.post("/enhance-prompt", response_model=EnhancedPromptResponse)
async def enhance_prompt(
    req: PromptEnhancementRequest,
    llm: LLMService = Depends(get_llm_service),
):
    enhanced = await llm.enhance_prompt(req.prompt, genre=req.genre, mood=req.mood)
    return EnhancedPromptResponse(
        original_prompt=req.prompt,
        enhanced_prompt=enhanced,
    )


@router.post("/suggest-style", response_model=StyleSuggestionResponse)
async def suggest_style(
    req: StyleSuggestionRequest,
    llm: LLMService = Depends(get_llm_service),
):
    suggestions = await llm.suggest_style(req.prompt)
    return StyleSuggestionResponse(suggestions=suggestions)


@router.post("/title", response_model=TitleGenerationResponse)
async def generate_title(
    req: TitleGenerationRequest,
    llm: LLMService = Depends(get_llm_service),
):
    title = await llm.generate_title(
        lyrics=req.lyrics, genre=req.genre, mood=req.mood, prompt=req.prompt
    )
    return TitleGenerationResponse(title=title)


@router.post("/cover-art", response_model=CoverArtResponse)
async def generate_cover_art(
    req: CoverArtRequest,
    svc: GenerationService = Depends(get_generation_service),
):
    try:
        path, prompt_used = await svc.generate_cover_for_existing(
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
    except Exception as exc:
        logger.exception("Cover art generation failed")
        raise HTTPException(
            status_code=502,
            detail=f"Image generation failed: {exc!s}",
        )
    return CoverArtResponse(cover_art_path=path, prompt_used=prompt_used)
