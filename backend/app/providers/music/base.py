from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class MusicProviderConfig(BaseModel):
    name: str
    provider_type: str
    label: str = Field(
        default="",
        description="Optional label to select a variant within the same provider type",
    )
    model_name: str
    model_id: str = Field(
        default="facebook/musicgen-small",
        description="HuggingFace model ID (e.g. facebook/musicgen-small)",
    )
    device: str = "auto"
    output_format: str = "wav"
    max_duration: int = Field(default=600, description="Max duration in seconds")
    model_kwargs: dict = Field(
        default_factory=dict,
        description="Extra kwargs passed to from_pretrained (e.g. subfolder, revision)",
    )


class MusicGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text description of desired music")
    lyrics: str | None = None
    duration: float = Field(default=30.0, ge=1.0, le=600.0)
    genre: str | None = None
    mood: str | None = None
    tempo: int | None = Field(default=None, ge=40, le=240)
    musical_key: str | None = None
    instruments: list[str] | None = None
    instrumental: bool = False
    seed: int | None = None
    language: str = Field(default="en", description="Vocal language code")


class MusicGenerationResponse(BaseModel):
    audio_path: str
    audio_data: bytes | None = None
    duration: float
    sample_rate: int
    format: str
    metadata: dict = Field(default_factory=dict)
    lrc_lyrics: str | None = None


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

    def check_downloaded(self) -> bool:
        """Return ``True`` if model weights are available locally.

        Default implementation checks the HuggingFace Hub cache for
        ``self.config.model_id``.  Subclasses may override for custom logic.
        """
        try:
            from huggingface_hub import scan_cache_dir

            cache_info = scan_cache_dir()
            cached_ids = {
                repo.repo_id for repo in cache_info.repos if repo.repo_type == "model"
            }
        except Exception:
            return False
        else:
            return self.config.model_id in cached_ids
