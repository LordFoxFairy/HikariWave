from datetime import datetime

from pydantic import BaseModel, Field

# --- Style Suggestion ---


class StyleSuggestion(BaseModel):
    genres: list[str] = Field(default_factory=list)
    moods: list[str] = Field(default_factory=list)
    tempo: int | None = None
    musical_key: str | None = None
    instruments: list[str] = Field(default_factory=list)
    title_suggestion: str | None = None
    references: list[str] = Field(default_factory=list)


class StyleSuggestionRequest(BaseModel):
    prompt: str = Field(..., description="Theme or lyrics to analyze")
    genre: str | None = None
    mood: str | None = None


class StyleSuggestionResponse(BaseModel):
    suggestions: StyleSuggestion


# --- Title Generation ---


class TitleGenerationRequest(BaseModel):
    lyrics: str | None = None
    genre: str | None = None
    mood: str | None = None
    prompt: str | None = None


class TitleGenerationResponse(BaseModel):
    title: str


# --- Cover Art ---


class CoverArtRequest(BaseModel):
    generation_id: int
    title: str | None = None
    genre: str | None = None
    mood: str | None = None
    lyrics: str | None = None


class CoverArtResponse(BaseModel):
    cover_art_path: str
    prompt_used: str


# --- Extend / Remix ---


class ExtendRequest(BaseModel):
    generation_id: int
    prompt: str | None = None
    lyrics: str | None = None
    duration: float = Field(default=30.0, ge=1.0, le=300.0)


class RemixRequest(BaseModel):
    generation_id: int
    genre: str | None = None
    mood: str | None = None
    tempo: int | None = Field(default=None, ge=40, le=240)
    musical_key: str | None = None
    instruments: list[str] | None = None
    prompt: str | None = None


# --- Music Generation ---


class MusicGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text description of desired music")
    lyrics: str | None = None
    title: str | None = None
    genre: str | None = None
    mood: str | None = None
    duration: float = Field(default=30.0, ge=1.0, le=300.0)
    tempo: int | None = Field(default=None, ge=40, le=240)
    musical_key: str | None = None
    instruments: list[str] | None = None
    language: str = "en"
    instrumental: bool = False
    seed: int | None = None
    pipeline: str | None = Field(
        default=None,
        description="Pipeline strategy name (e.g. 'vocal_instrumental'). None = direct single-model.",
    )
    enhance_prompt: bool = Field(
        default=True,
        description="Whether to enhance the prompt via LLM",
    )
    generate_lyrics: bool = Field(
        default=False,
        description="Whether to auto-generate lyrics via LLM",
    )
    generate_cover: bool = Field(
        default=True,
        description="Whether to auto-generate cover art",
    )


# --- Lyrics ---


class LyricsGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Theme or description")
    genre: str | None = None
    mood: str | None = None
    language: str = "en"


class PromptEnhancementRequest(BaseModel):
    prompt: str = Field(..., description="Brief description to enhance")
    genre: str | None = None
    mood: str | None = None


class LyricsResponse(BaseModel):
    lyrics: str
    genre: str | None = None
    mood: str | None = None
    suggestions: StyleSuggestion | None = None


class EnhancedPromptResponse(BaseModel):
    original_prompt: str
    enhanced_prompt: str


# --- Pipeline ---


class PipelineInfo(BaseModel):
    name: str
    description: str = ""


class PipelineListResponse(BaseModel):
    pipelines: list[PipelineInfo]


# --- Task / Generation Responses ---


class TaskResponse(BaseModel):
    task_id: str
    status: str


class GenerationResponse(BaseModel):
    id: int
    task_id: str
    status: str
    prompt: str
    enhanced_prompt: str | None = None
    lyrics: str | None = None
    genre: str | None = None
    mood: str | None = None
    duration: float
    title: str | None = None
    cover_art_path: str | None = None
    tempo: int | None = None
    musical_key: str | None = None
    instruments: list[str] | None = None
    language: str | None = None
    instrumental: bool = False
    llm_provider: str | None = None
    music_provider: str
    audio_path: str | None = None
    audio_format: str = "wav"
    actual_duration: float | None = None
    progress: int = 0
    progress_message: str | None = None
    is_liked: bool = False
    parent_id: int | None = None
    parent_type: str | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


# --- Like ---


class LikeResponse(BaseModel):
    generation_id: int
    is_liked: bool


class GenerationListResponse(BaseModel):
    items: list[GenerationResponse]
    total: int
