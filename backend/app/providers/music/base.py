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
    """Model-agnostic request for music generation.

    ``lyrics`` is always in **LRC format** (``[MM:SS.xx]text``).
    Providers that need plain text should strip timestamps internally.
    """

    prompt: str = Field(..., description="Text caption describing desired music")
    lyrics: str | None = Field(
        default=None,
        description="Lyrics in LRC format ([MM:SS.xx]text). Providers strip timestamps if needed.",
    )
    duration: float = Field(default=30.0, ge=1.0, le=600.0)
    tempo: int | None = Field(default=None, ge=40, le=240)
    musical_key: str | None = None
    instrumental: bool = False
    seed: int | None = None
    language: str = Field(default="en", description="Vocal language code")

    # -- Style transfer / Cover / Repaint --
    reference_audio_path: str | None = Field(
        default=None, description="Path to reference audio for style/timbre guidance",
    )
    src_audio_path: str | None = Field(
        default=None, description="Path to source audio for cover or repaint",
    )
    task_type: str = Field(
        default="text2music",
        description="Generation task type: text2music, cover, or repaint",
    )
    audio_cover_strength: float = Field(
        default=1.0, ge=0.0, le=1.0,
        description="Cover strength (0.0 = ignore source, 1.0 = faithful cover)",
    )
    cover_noise_strength: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Noise injection strength for cover generation",
    )
    repainting_start: float = Field(
        default=0.0, ge=0.0,
        description="Repaint region start time in seconds",
    )
    repainting_end: float | None = Field(
        default=None,
        description="Repaint region end time in seconds (None = end of audio)",
    )


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
