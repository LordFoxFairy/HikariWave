from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class ImageProviderConfig(BaseModel):
    name: str
    provider_type: str
    model_name: str
    api_key: str = ""
    base_url: str = ""
    default_width: int = 1024
    default_height: int = 1024


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt for image generation")
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    num_inference_steps: int | None = None
    seed: int | None = None
    guidance_scale: float | None = None


class ImageGenerationResponse(BaseModel):
    image_path: str
    width: int
    height: int
    format: str
    metadata: dict = Field(default_factory=dict)


class BaseImageProvider(ABC):
    def __init__(self, config: ImageProviderConfig):
        self.config = config
        self._model = None

    @abstractmethod
    async def load_model(self) -> None: ...

    @abstractmethod
    async def generate(
        self, request: ImageGenerationRequest
    ) -> ImageGenerationResponse: ...

    @abstractmethod
    async def unload_model(self) -> None: ...

    @abstractmethod
    async def health_check(self) -> bool: ...

    @property
    def is_loaded(self) -> bool:
        return self._model is not None
