import logging
import uuid
from pathlib import Path

from backend.app.core.settings import settings
from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicGenerationRequest,
    MusicGenerationResponse,
)

logger = logging.getLogger(__name__)


class ACEStepProvider(BaseMusicProvider):
    """ACE-Step model: full songs with vocals and lyrics alignment.

    Requires torch + the ACE-Step model weights. When the GPU
    dependencies are not installed this provider will report
    unhealthy and refuse to generate.
    """

    async def load_model(self) -> None:
        logger.info(
            "Loading ACE-Step model on device=%s",
            self.config.device,
        )
        try:
            import torch  # noqa: F401
        except ImportError:
            raise RuntimeError(
                "torch is required for ACE-Step. "
                "Install with: pip install hikariwave-backend[gpu]"
            )
        # TODO: load actual ACE-Step pipeline here
        self._model = "ace-step-placeholder"
        logger.info("ACE-Step model loaded (placeholder)")

    async def generate(
        self, request: MusicGenerationRequest
    ) -> MusicGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        output_dir = Path(settings.storage_dir) / settings.audio_subdir
        output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{uuid.uuid4().hex}.{self.config.output_format}"
        output_path = output_dir / file_name

        logger.info("ACE-Step generating: prompt=%s", request.prompt[:80])
        # TODO: replace with actual ACE-Step inference
        # Placeholder: write an empty wav file
        import wave

        with wave.open(str(output_path), "w") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(self.config.sample_rate)
            n_frames = int(request.duration * self.config.sample_rate)
            wf.writeframes(b"\x00" * n_frames * 4)

        return MusicGenerationResponse(
            audio_path=str(output_path),
            duration=request.duration,
            sample_rate=self.config.sample_rate,
            format=self.config.output_format,
            metadata={"model": "ace-step-v1", "device": self.config.device},
        )

    async def unload_model(self) -> None:
        self._model = None
        logger.info("ACE-Step model unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401

            return True
        except ImportError:
            return False
