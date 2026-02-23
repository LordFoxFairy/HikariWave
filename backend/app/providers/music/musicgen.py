import logging
import uuid
import wave
from pathlib import Path

from backend.app.core.settings import settings
from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicGenerationRequest,
    MusicGenerationResponse,
)

logger = logging.getLogger(__name__)


class MusicGenProvider(BaseMusicProvider):
    """Meta MusicGen: instrumental music generation."""

    async def load_model(self) -> None:
        logger.info(
            "Loading MusicGen model on device=%s",
            self.config.device,
        )
        try:
            import torch  # noqa: F401
        except ImportError:
            raise RuntimeError(
                "torch is required for MusicGen. "
                "Install with: pip install hikariwave-backend[gpu]"
            )
        # TODO: load actual MusicGen pipeline here
        self._model = "musicgen-placeholder"
        logger.info("MusicGen model loaded (placeholder)")

    async def generate(
        self, request: MusicGenerationRequest
    ) -> MusicGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        output_dir = Path(settings.storage_dir) / settings.audio_subdir
        output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{uuid.uuid4().hex}.{self.config.output_format}"
        output_path = output_dir / file_name

        clamped_duration = min(request.duration, 30.0)
        logger.info("MusicGen generating: prompt=%s", request.prompt[:80])
        # TODO: replace with actual MusicGen inference
        with wave.open(str(output_path), "w") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.config.sample_rate)
            n_frames = int(clamped_duration * self.config.sample_rate)
            wf.writeframes(b"\x00" * n_frames * 2)

        return MusicGenerationResponse(
            audio_path=str(output_path),
            duration=clamped_duration,
            sample_rate=self.config.sample_rate,
            format=self.config.output_format,
            metadata={"model": "musicgen-large", "device": self.config.device},
        )

    async def unload_model(self) -> None:
        self._model = None
        logger.info("MusicGen model unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401

            return True
        except ImportError:
            return False
