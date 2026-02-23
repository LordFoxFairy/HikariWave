import base64
import logging
import uuid
from pathlib import Path

import httpx

from backend.app.core.settings import settings
from backend.app.providers.image.base import (
    BaseImageProvider,
    ImageGenerationRequest,
    ImageGenerationResponse,
)

logger = logging.getLogger(__name__)

TOGETHER_API_URL = "https://api.together.xyz/v1/images/generations"


class TogetherImageProvider(BaseImageProvider):
    """Together AI image generation provider using FLUX models."""

    async def load_model(self) -> None:
        # API-based provider, no local model to load
        self._model = "together-api"
        logger.info("Together image provider ready: model=%s", self.config.model_name)

    async def generate(
        self, request: ImageGenerationRequest
    ) -> ImageGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        output_dir = Path(settings.storage_dir) / "covers"
        output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{uuid.uuid4().hex}.png"
        output_path = output_dir / file_name

        payload: dict = {
            "model": self.config.model_name,
            "prompt": request.prompt,
            "width": request.width,
            "height": request.height,
            "n": 1,
            "response_format": "b64_json",
        }
        if request.num_inference_steps is not None:
            payload["steps"] = request.num_inference_steps
        if request.seed is not None:
            payload["seed"] = request.seed

        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

        logger.info(
            "Together image generation: model=%s prompt=%s",
            self.config.model_name,
            request.prompt[:80],
        )

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                self.config.base_url or TOGETHER_API_URL,
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        # Extract base64 image data from response
        image_b64 = data["data"][0]["b64_json"]
        image_bytes = base64.b64decode(image_b64)

        output_path.write_bytes(image_bytes)
        logger.info("Cover art saved: %s", output_path)

        return ImageGenerationResponse(
            image_path=str(output_path),
            width=request.width,
            height=request.height,
            format="png",
            metadata={
                "model": self.config.model_name,
                "provider": "together",
            },
        )

    async def unload_model(self) -> None:
        self._model = None
        logger.info("Together image provider unloaded")

    async def health_check(self) -> bool:
        if not self.config.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.together.xyz/v1/models",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                )
                return resp.status_code == 200
        except Exception:
            logger.exception("Together health check failed")
            return False
