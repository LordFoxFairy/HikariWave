import asyncio
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

# MusicGen generates 50 codec frames per second of audio
_TOKENS_PER_SECOND = 50
# Hard limit from sinusoidal positional embeddings
_MAX_TOKENS = 1503  # ~30 seconds


def _select_device() -> str:
    """Pick the best available torch device: mps > cuda > cpu."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _build_prompt(request: MusicGenerationRequest) -> str:
    """Compose a rich text prompt from structured request fields."""
    parts: list[str] = []

    if request.prompt:
        parts.append(request.prompt)

    if request.genre:
        parts.append(f"{request.genre} style")
    if request.mood:
        parts.append(f"{request.mood} mood")
    if request.tempo:
        parts.append(f"{request.tempo} BPM")
    if request.musical_key:
        parts.append(f"in the key of {request.musical_key}")
    if request.instruments:
        parts.append(f"featuring {', '.join(request.instruments)}")
    if request.instrumental:
        parts.append("instrumental, no vocals")

    return ", ".join(parts) if parts else "instrumental music"


class MusicGenProvider(BaseMusicProvider):
    """Meta MusicGen: instrumental music generation via HuggingFace Transformers."""

    _processor: object | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def load_model(self) -> None:
        device = self.config.device or "auto"
        model_id = getattr(self.config, "model_id", None) or "facebook/musicgen-small"
        cache_dir = getattr(self.config, "cache_dir", None)

        logger.info(
            "Loading MusicGen model=%s device=%s cache_dir=%s",
            model_id,
            device,
            cache_dir,
        )

        try:
            import torch  # noqa: F401
            from transformers import (
                AutoProcessor,
                MusicgenForConditionalGeneration,
            )
        except ImportError as exc:
            raise RuntimeError(
                "torch and transformers are required for MusicGen. "
                "Install with: pip install hikariwave-backend[gpu]"
            ) from exc

        # Resolve device
        if device == "auto":
            device = _select_device()

        def _load() -> None:
            processor = AutoProcessor.from_pretrained(model_id, cache_dir=cache_dir)
            model = MusicgenForConditionalGeneration.from_pretrained(
                model_id, cache_dir=cache_dir
            )

            # Move model to device; MPS may not support all dtypes so keep
            # float32 for safety.
            model = model.to(device)
            model.eval()

            self._processor = processor
            self._model = model

        # Heavy I/O + weight loading -- run in a thread so we don't block the
        # event loop.
        await asyncio.to_thread(_load)

        # Persist the resolved device for later use
        self.config.device = device
        logger.info("MusicGen model loaded on %s", device)

    async def unload_model(self) -> None:
        if self._model is not None:
            try:
                import torch

                device = str(next(self._model.parameters()).device)
                del self._model
                del self._processor
                self._model = None
                self._processor = None

                if device.startswith("cuda"):
                    torch.cuda.empty_cache()
                elif device == "mps":
                    torch.mps.empty_cache()
            except Exception:
                self._model = None
                self._processor = None
        logger.info("MusicGen model unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401
            from transformers import MusicgenForConditionalGeneration  # noqa: F401

            return True
        except ImportError:
            return False

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    async def generate(
        self, request: MusicGenerationRequest
    ) -> MusicGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        # Prepare output path
        output_dir = Path(settings.storage_dir) / settings.audio_subdir
        output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{uuid.uuid4().hex}.{self.config.output_format}"
        output_path = output_dir / file_name

        # Clamp duration to 30s (model limit)
        clamped_duration = min(request.duration, 30.0)
        max_new_tokens = min(
            int(clamped_duration * _TOKENS_PER_SECOND),
            _MAX_TOKENS,
        )

        prompt_text = _build_prompt(request)
        logger.info(
            "MusicGen generating: prompt=%r duration=%.1fs tokens=%d",
            prompt_text[:120],
            clamped_duration,
            max_new_tokens,
        )

        def _generate_audio() -> tuple[int, str]:
            import torch

            processor = self._processor
            model = self._model
            device = self.config.device

            # Tokenize
            inputs = processor(
                text=[prompt_text],
                padding=True,
                return_tensors="pt",
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}

            # Generate
            with torch.no_grad():
                generate_kwargs: dict = {
                    "do_sample": True,
                    "guidance_scale": 3.0,
                    "max_new_tokens": max_new_tokens,
                }
                if request.seed is not None:
                    torch.manual_seed(request.seed)

                audio_values = model.generate(**inputs, **generate_kwargs)

            # audio_values shape: (batch, channels, samples)
            audio_np = audio_values[0, 0].cpu().float().numpy()

            sampling_rate = model.config.audio_encoder.sampling_rate

            # Save WAV via scipy
            import scipy.io.wavfile

            scipy.io.wavfile.write(str(output_path), rate=sampling_rate, data=audio_np)

            # Clear intermediate tensors
            del audio_values, inputs
            if device.startswith("cuda"):
                torch.cuda.empty_cache()
            elif device == "mps":
                torch.mps.empty_cache()

            return sampling_rate, str(output_path)

        sampling_rate, audio_path = await asyncio.to_thread(_generate_audio)

        return MusicGenerationResponse(
            audio_path=audio_path,
            duration=clamped_duration,
            sample_rate=sampling_rate,
            format=self.config.output_format,
            metadata={
                "model": getattr(self.config, "model_id", "facebook/musicgen-small"),
                "device": self.config.device,
                "prompt": prompt_text[:200],
            },
        )
