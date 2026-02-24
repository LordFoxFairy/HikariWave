"""HuggingFace music provider for standard models.

Loads standard HuggingFace music models (MusicGen, AudioLDM, etc.)
via ``AutoModelForTextToWaveform`` + ``AutoProcessor``, with a
``trust_remote_code`` fallback for custom single-model architectures.

Multi-component models like ACE-Step have their own dedicated provider
(see ``acestep.py``).
"""

from __future__ import annotations

import asyncio
import gc
import logging
from typing import Any

from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicGenerationRequest,
    MusicGenerationResponse,
    MusicProviderConfig,
)
from backend.app.providers.music.utils import select_device, to_wav

logger = logging.getLogger(__name__)

_TOKENS_PER_SECOND = 50
_MAX_TOKENS = 1503


class HuggingFaceMusicProvider(BaseMusicProvider):
    """Provider for standard HuggingFace music models.

    Loading strategy:

    1. Try ``AutoModelForTextToWaveform`` — works for models with a
       registered architecture (MusicGen, AudioLDM, etc.).
    2. Fall back to ``AutoModel(trust_remote_code=True)`` — works for
       custom single-model architectures.
    """

    def __init__(self, config: MusicProviderConfig) -> None:
        super().__init__(config)
        self._processor: Any = None
        self._device: str = "cpu"

    # -- Lifecycle ---------------------------------------------------------

    async def load_model(self) -> None:
        model_id = self.config.model_id

        try:
            import torch
        except ImportError as exc:
            raise RuntimeError(
                "PyTorch is required. Install with: pip install hikariwave[gpu]"
            ) from exc

        if not self.check_downloaded():
            raise RuntimeError(
                f"Model not downloaded: {model_id}. "
                "Please download it from the model marketplace first."
            )

        self._device = (
            select_device()
            if (self.config.device or "auto") == "auto"
            else self.config.device
        )

        def _load() -> tuple[Any, Any]:
            dtype = torch.float32 if self._device == "mps" else torch.float16
            model_kwargs = dict(self.config.model_kwargs)

            # Strategy 1: standard transformers architecture
            try:
                from transformers import AutoModelForTextToWaveform, AutoProcessor

                model = AutoModelForTextToWaveform.from_pretrained(
                    model_id, torch_dtype=dtype,
                ).to(self._device)
                processor = AutoProcessor.from_pretrained(model_id)
                logger.info("Loaded %s via AutoModelForTextToWaveform", model_id)
                return model, processor
            except Exception:
                pass

            # Strategy 2: custom model with trust_remote_code
            from transformers import AutoModel

            pretrained_kwargs: dict[str, Any] = {
                "torch_dtype": dtype,
                "trust_remote_code": True,
                **model_kwargs,
            }
            model = AutoModel.from_pretrained(
                model_id, **pretrained_kwargs,
            ).to(self._device)
            model.eval()
            logger.info("Loaded %s via AutoModel (trust_remote_code)", model_id)
            return model, None

        logger.info("Loading model=%s device=%s", model_id, self._device)
        self._model, self._processor = await asyncio.to_thread(_load)

    async def unload_model(self) -> None:
        if self._model is None:
            return
        device = self._device
        for attr in ("_model", "_processor"):
            setattr(self, attr, None)
        gc.collect()
        try:
            import torch

            if device.startswith("cuda") and torch.cuda.is_available():
                torch.cuda.empty_cache()
            elif device == "mps":
                torch.mps.empty_cache()
        except Exception:
            pass
        logger.info("Model unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401
        except ImportError:
            return False
        return True

    # -- Generation --------------------------------------------------------

    async def generate(
        self, request: MusicGenerationRequest,
    ) -> MusicGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        if self._model is None:
            raise RuntimeError(
                f"Model failed to load: {self.config.model_id}. Check logs."
            )

        duration = min(request.duration, float(self.config.max_duration))
        logger.info("Generating: %r (%.0fs)", request.prompt[:80], duration)

        if self._processor is not None:
            wav_bytes, sr = await self._generate_standard(request, duration)
        else:
            wav_bytes, sr = await self._generate_custom(request, duration)

        return MusicGenerationResponse(
            audio_path="",
            audio_data=wav_bytes,
            duration=duration,
            sample_rate=sr,
            format="wav",
            metadata={
                "model": self.config.model_id,
                "device": self._device,
                "prompt": request.prompt[:200],
            },
        )

    async def _generate_standard(
        self, request: MusicGenerationRequest, duration: float,
    ) -> tuple[bytes, int]:
        """Generate with a standard transformers model (MusicGen, etc.)."""

        def _run() -> tuple[bytes, int]:
            import torch

            if request.seed is not None:
                torch.manual_seed(request.seed)

            inputs = self._processor(
                text=[request.prompt], padding=True, return_tensors="pt",
            ).to(self._device)

            max_tokens = min(int(duration * _TOKENS_PER_SECOND), _MAX_TOKENS)
            audio_values = self._model.generate(
                **inputs, max_new_tokens=max_tokens, do_sample=True,
            )

            audio_np = audio_values[0].cpu().float().numpy()
            encoder_cfg = getattr(self._model.config, "audio_encoder", None)
            sr = getattr(encoder_cfg or self._model.config, "sampling_rate", 32000)
            return to_wav(audio_np, sr)

        return await self._run_in_thread(_run)

    async def _generate_custom(
        self, request: MusicGenerationRequest, duration: float,
    ) -> tuple[bytes, int]:
        """Generate with a custom model (fallback for unknown architectures)."""

        def _run() -> tuple[bytes, int]:
            import torch

            if request.seed is not None:
                torch.manual_seed(request.seed)

            kwargs: dict[str, Any] = {
                "prompt": request.prompt,
                "duration": duration,
                "seed": request.seed if request.seed is not None else -1,
            }
            if request.lyrics:
                kwargs["lyrics"] = request.lyrics

            model = self._model
            result = (
                model.generate(**kwargs)
                if hasattr(model, "generate")
                else model(**kwargs)
            )

            audio, sr = _parse_result(result)
            return to_wav(audio, sr)

        return await self._run_in_thread(_run)

    # -- Helpers -----------------------------------------------------------

    async def _run_in_thread(
        self, fn: Any,
    ) -> tuple[bytes, int]:
        """Run generation in a thread with OOM handling."""
        try:
            return await asyncio.to_thread(fn)
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                raise RuntimeError(
                    f"GPU out of memory with {self.config.model_id}. "
                    "Try a smaller model or reduce duration."
                ) from exc
            raise


# -- Module-level helpers -----------------------------------------------------


def _parse_result(result: Any) -> tuple[Any, int]:
    """Extract audio tensor and sample rate from model output."""
    if isinstance(result, dict):
        audio = (
            result.get("audio")
            or result.get("pred_wavs")
            or result.get("waveform")
        )
        sr = result.get(
            "sr",
            result.get("sample_rate", result.get("sampling_rate", 44100)),
        )
        return audio, sr

    if isinstance(result, tuple):
        return result[0], (result[1] if len(result) > 1 else 44100)

    return result, 44100


