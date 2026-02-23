from __future__ import annotations

import asyncio
import gc
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

# ACE-Step native sample rate is 48 kHz.
ACE_STEP_SAMPLE_RATE = 48000

# Default HuggingFace model identifier.
ACE_STEP_REPO_ID = "ACE-Step/Ace-Step1.5"


def _resolve_device() -> str:
    """Return the best available device string: cuda > mps > cpu."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _resolve_dtype(device: str) -> str:
    """Return dtype string compatible with the device.

    MPS does not support bfloat16, so we fall back to float32 there.
    """
    if device == "mps":
        return "float32"
    return "bfloat16"


class ACEStepProvider(BaseMusicProvider):
    """ACE-Step v1.5 music generation provider.

    Uses the ``ace_step`` package (``acestep.pipeline_ace_step.ACEStepPipeline``)
    to generate full songs with vocals and lyrics alignment.  Model weights are
    downloaded automatically from HuggingFace on first load.

    Requirements:
        pip install git+https://github.com/ace-step/ACE-Step.git
        pip install torch torchaudio
    """

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def load_model(self) -> None:
        device = self.config.device or "auto"
        logger.info("Loading ACE-Step model (device=%s) ...", device)

        try:
            import torch  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                "torch is required for ACE-Step. "
                "Install with: pip install torch torchaudio"
            ) from exc

        try:
            from acestep.pipeline_ace_step import ACEStepPipeline
        except ImportError as exc:
            raise RuntimeError(
                "ace_step package is required. "
                "Install with: pip install git+https://github.com/ace-step/ACE-Step.git"
            ) from exc

        if device == "auto":
            device = _resolve_device()

        dtype = _resolve_dtype(device)
        use_cpu_offload = device == "cpu"

        # ACEStepPipeline downloads weights from HuggingFace automatically
        # when ``checkpoint_dir`` is None.
        loop = asyncio.get_running_loop()
        pipeline = await loop.run_in_executor(
            None,
            lambda: ACEStepPipeline(
                checkpoint_dir=None,
                dtype=dtype,
                torch_compile=False,
                cpu_offload=use_cpu_offload,
                overlapped_decode=False,
            ),
        )

        self._model = pipeline
        self._device = device
        logger.info("ACE-Step model loaded on %s (dtype=%s)", device, dtype)

    async def unload_model(self) -> None:
        if self._model is not None:
            del self._model
            self._model = None
            gc.collect()
            try:
                import torch

                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
        logger.info("ACE-Step model unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401
            from acestep.pipeline_ace_step import ACEStepPipeline  # noqa: F401

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

        pipeline = self._model

        # ----- Build output path -----
        output_dir = Path(settings.storage_dir) / settings.audio_subdir
        output_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{uuid.uuid4().hex}.wav"
        output_path = output_dir / file_name

        # ----- Compose prompt from structured fields -----
        prompt = self._build_prompt(request)
        lyrics = request.lyrics or ""
        if request.instrumental:
            lyrics = "[inst]"

        duration = min(request.duration, float(self.config.max_duration))

        # Seed handling
        manual_seeds: int | None = request.seed

        logger.info(
            "ACE-Step generating: duration=%.1fs prompt=%s",
            duration,
            prompt[:120],
        )

        # ----- Run inference in a thread to avoid blocking the event loop -----
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            lambda: pipeline(
                audio_duration=duration,
                prompt=prompt,
                lyrics=lyrics,
                infer_step=60,
                guidance_scale=15.0,
                scheduler_type="euler",
                cfg_type="apg",
                omega_scale=10.0,
                manual_seeds=manual_seeds,
                guidance_interval=0.5,
                guidance_interval_decay=0.0,
                min_guidance_scale=3.0,
                use_erg_tag=True,
                use_erg_lyric=True,
                use_erg_diffusion=True,
                oss_steps=None,
                guidance_scale_text=0.0,
                guidance_scale_lyric=0.0,
                save_path=str(output_path),
            ),
        )

        # The pipeline returns [audio_path_1, ..., params_dict].
        # For batch_size=1 this is [audio_path, params_dict].
        audio_path = str(output_path)
        if isinstance(results, list) and len(results) >= 2:
            # First element is the generated audio path.
            audio_path = str(results[0])

        return MusicGenerationResponse(
            audio_path=audio_path,
            duration=duration,
            sample_rate=ACE_STEP_SAMPLE_RATE,
            format="wav",
            metadata={
                "model": ACE_STEP_REPO_ID,
                "device": getattr(self, "_device", self.config.device),
                "prompt": prompt[:200],
            },
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(request: MusicGenerationRequest) -> str:
        """Combine structured fields into a single ACE-Step tag prompt.

        ACE-Step expects a comma-separated tag string describing genre,
        mood, tempo, instruments, etc.
        """
        parts: list[str] = []

        if request.genre:
            parts.append(request.genre)
        if request.mood:
            parts.append(request.mood)
        if request.tempo:
            parts.append(f"{request.tempo} bpm")
        if request.musical_key:
            parts.append(f"key of {request.musical_key}")
        if request.instruments:
            parts.extend(request.instruments)
        if request.instrumental:
            parts.append("instrumental")

        # Append the free-text prompt (may overlap, but that is fine for
        # tag-based conditioning).
        if request.prompt:
            parts.append(request.prompt)

        return ", ".join(parts)
