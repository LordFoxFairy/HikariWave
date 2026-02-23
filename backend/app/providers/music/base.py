from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class MusicProviderConfig(BaseModel):
    name: str
    provider_type: str
    model_name: str
    model_id: str = Field(
        default="facebook/musicgen-small",
        description="HuggingFace model ID (e.g. facebook/musicgen-small)",
    )
    cache_dir: str | None = Field(
        default=None,
        description="Custom cache directory for downloaded model weights",
    )
    device: str = "cpu"
    output_format: str = "wav"
    sample_rate: int = 32000
    max_duration: int = Field(default=120, description="Max duration in seconds")


class MusicGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text description of desired music")
    lyrics: str | None = None
    duration: float = Field(default=30.0, ge=1.0, le=300.0)
    genre: str | None = None
    mood: str | None = None
    tempo: int | None = Field(default=None, ge=40, le=240)
    musical_key: str | None = None
    instruments: list[str] | None = None
    instrumental: bool = False
    seed: int | None = None


class MusicGenerationResponse(BaseModel):
    audio_path: str
    duration: float
    sample_rate: int
    format: str
    metadata: dict = Field(default_factory=dict)


class BaseMusicProvider(ABC):
    def __init__(self, config: MusicProviderConfig):
        self.config = config
        self._model = None

    @abstractmethod
    async def load_model(self) -> None: ...

    @abstractmethod
    async def generate(
        self, request: MusicGenerationRequest
    ) -> MusicGenerationResponse: ...

    @abstractmethod
    async def unload_model(self) -> None: ...

    @abstractmethod
    async def health_check(self) -> bool: ...

    @property
    def is_loaded(self) -> bool:
        return self._model is not None
