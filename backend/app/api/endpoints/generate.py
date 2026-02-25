import json
import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.app.api.dependencies import get_generation_service, get_llm_service
from backend.app.schemas.generation import (
    CoverArtRequest,
    CoverArtResponse,
    EnhancedPromptResponse,
    ExtendRequest,
    LyricsGenerationRequest,
    LyricsResponse,
    MusicGenerationRequest,
    PromptEnhancementRequest,
    RemixRequest,
    StyleReferenceRequest,
    StyleReferenceResponse,
    StyleSuggestionRequest,
    StyleSuggestionResponse,
    TaskResponse,
    TitleGenerationRequest,
    TitleGenerationResponse,
)
from backend.app.services.music_generation import GenerationService
from backend.app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["generate"])


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
        seed=req.seed,
        enhance_prompt=req.enhance_prompt,
        generate_lyrics=req.generate_lyrics,
        generate_cover=req.generate_cover,
        task_type=req.task_type,
        audio_cover_strength=req.audio_cover_strength,
        cover_noise_strength=req.cover_noise_strength,
        repainting_start=req.repainting_start,
        repainting_end=req.repainting_end,
    )
    return TaskResponse(task_id=gen.task_id, status=gen.status)


_UPLOAD_DIR = Path(tempfile.gettempdir()) / "hikariwave_uploads"
_ALLOWED_AUDIO_EXTS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"}


async def _save_upload(upload: UploadFile) -> str:
    """Save an ``UploadFile`` to a temp directory and return the path."""
    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload.filename or "audio").suffix.lower()
    if suffix not in _ALLOWED_AUDIO_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {suffix}. Allowed: {', '.join(_ALLOWED_AUDIO_EXTS)}",
        )
    dest = _UPLOAD_DIR / f"{__import__('uuid').uuid4().hex}{suffix}"
    content = await upload.read()
    dest.write_bytes(content)
    return str(dest)


@router.post("/music-with-audio", response_model=TaskResponse)
async def generate_music_with_audio(
    prompt: str = Form(...),
    lyrics: str | None = Form(None),
    title: str | None = Form(None),
    genre: str | None = Form(None),
    mood: str | None = Form(None),
    duration: float = Form(240.0),
    tempo: int | None = Form(None),
    musical_key: str | None = Form(None),
    instruments: str | None = Form(None),
    language: str = Form("en"),
    instrumental: bool = Form(False),
    seed: int | None = Form(None),
    enhance_prompt: bool = Form(True),
    generate_lyrics: bool = Form(False),
    generate_cover: bool = Form(True),
    task_type: str = Form("text2music"),
    audio_cover_strength: float = Form(1.0),
    cover_noise_strength: float = Form(0.0),
    repainting_start: float = Form(0.0),
    repainting_end: float | None = Form(None),
    reference_audio: UploadFile | None = File(None),
    src_audio: UploadFile | None = File(None),
    svc: GenerationService = Depends(get_generation_service),
):
    """Generate music with optional audio file uploads (multipart/form-data)."""
    reference_audio_path: str | None = None
    src_audio_path: str | None = None

    if reference_audio and reference_audio.filename:
        reference_audio_path = await _save_upload(reference_audio)
    if src_audio and src_audio.filename:
        src_audio_path = await _save_upload(src_audio)

    instruments_list: list[str] | None = None
    if instruments:
        try:
            instruments_list = json.loads(instruments)
        except json.JSONDecodeError:
            instruments_list = [i.strip() for i in instruments.split(",") if i.strip()]

    gen = await svc.create_generation(
        prompt=prompt,
        duration=duration,
        genre=genre,
        mood=mood,
        lyrics=lyrics,
        title=title,
        tempo=tempo,
        musical_key=musical_key,
        instruments=instruments_list,
        language=language,
        instrumental=instrumental,
        seed=seed,
        enhance_prompt=enhance_prompt,
        generate_lyrics=generate_lyrics,
        generate_cover=generate_cover,
        task_type=task_type,
        reference_audio_path=reference_audio_path,
        src_audio_path=src_audio_path,
        audio_cover_strength=audio_cover_strength,
        cover_noise_strength=cover_noise_strength,
        repainting_start=repainting_start,
        repainting_end=repainting_end,
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
    try:
        lyrics = await llm.generate_lyrics(
            req.prompt, genre=req.genre, mood=req.mood, language=req.language,
            duration=req.duration, title=req.title,
        )

        return LyricsResponse(
            lyrics=lyrics,
            genre=req.genre,
            mood=req.mood,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/enhance-prompt", response_model=EnhancedPromptResponse)
async def enhance_prompt(
    req: PromptEnhancementRequest,
    llm: LLMService = Depends(get_llm_service),
):
    try:
        enhanced = await llm.enhance_prompt(req.prompt, genre=req.genre, mood=req.mood)
        return EnhancedPromptResponse(
            original_prompt=req.prompt,
            enhanced_prompt=enhanced,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/suggest-style", response_model=StyleSuggestionResponse)
async def suggest_style(
    req: StyleSuggestionRequest,
    llm: LLMService = Depends(get_llm_service),
):
    try:
        suggestions = await llm.suggest_style(req.prompt)
        return StyleSuggestionResponse(suggestions=suggestions)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/title", response_model=TitleGenerationResponse)
async def generate_title(
    req: TitleGenerationRequest,
    llm: LLMService = Depends(get_llm_service),
):
    try:
        title = await llm.generate_title(
            lyrics=req.lyrics, genre=req.genre, mood=req.mood, prompt=req.prompt
        )
        return TitleGenerationResponse(title=title)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/analyze-style", response_model=StyleReferenceResponse)
async def analyze_style(
    req: StyleReferenceRequest,
    llm: LLMService = Depends(get_llm_service),
):
    try:
        result = await llm.analyze_style_reference(req.description)
        return StyleReferenceResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


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

