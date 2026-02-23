from datetime import datetime

from pydantic import BaseModel, Field


class MusicGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text description of desired music")
    lyrics: str | None = None
    genre: str | None = None
    mood: str | None = None
    duration: float = Field(default=30.0, ge=1.0, le=300.0)
    tempo: int | None = Field(default=None, ge=40, le=240)
    seed: int | None = None
    enhance_prompt: bool = Field(
        default=True,
        description="Whether to enhance the prompt via LLM",
    )
    generate_lyrics: bool = Field(
        default=False,
        description="Whether to auto-generate lyrics via LLM",
    )


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


class EnhancedPromptResponse(BaseModel):
    original_prompt: str
    enhanced_prompt: str


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
    llm_provider: str | None = None
    music_provider: str
    audio_path: str | None = None
    audio_format: str = "wav"
    actual_duration: float | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


class GenerationListResponse(BaseModel):
    items: list[GenerationResponse]
    total: int
