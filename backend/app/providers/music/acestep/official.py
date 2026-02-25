"""ACE-Step Handler provider.

Uses the official ``ace-step`` package (``AceStepHandler``) for music
generation.  This provider delegates all model loading, text encoding,
diffusion, and VAE decoding to the handler — no manual component
assembly required.

Install via::

    uv sync --extra ace-step

Configurable via ``config.yaml``::

    - name: acestep
      type: acestep
      label: handler
      models:
        - name: ace-step-v1.5
          model_kwargs:
            config_path: acestep-v15-turbo
            device: auto
            use_mlx_dit: true
"""

from __future__ import annotations

import asyncio
import gc
import logging
import sys
from pathlib import Path
from typing import Any

from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicGenerationRequest,
    MusicGenerationResponse,
    MusicProviderConfig,
)
from backend.app.providers.music.utils import to_wav

logger = logging.getLogger(__name__)

_VENDOR_DIR = str(
    Path(__file__).resolve().parents[4] / "vendor" / "ACE-Step-1.5"
)


def _ensure_vendor_on_path() -> None:
    """Add the vendor directory to ``sys.path`` so ``acestep`` is importable."""
    if _VENDOR_DIR not in sys.path:
        sys.path.insert(0, _VENDOR_DIR)


class AceStepHandlerProvider(BaseMusicProvider):
    """Provider backed by the official ``AceStepHandler``.

    The handler manages its own model lifecycle (DiT, VAE, text
    encoder, tokenizer) via ``initialize_service`` / ``generate_music``.
    """

    def __init__(self, config: MusicProviderConfig) -> None:
        super().__init__(config)
        self._handler: Any = None

    # -- Lifecycle ------------------------------------------------------------

    async def load_model(self) -> None:
        def _load() -> Any:
            _ensure_vendor_on_path()
            from acestep.handler import AceStepHandler

            handler = AceStepHandler()

            kwargs = dict(self.config.model_kwargs)
            config_path = kwargs.pop("config_path", "acestep-v15-turbo")
            device = kwargs.pop("device", "auto")
            use_mlx_dit = kwargs.pop("use_mlx_dit", True)

            msg, ok = handler.initialize_service(
                project_root=_VENDOR_DIR,
                config_path=config_path,
                device=device,
                use_mlx_dit=use_mlx_dit,
                **kwargs,
            )
            if not ok:
                raise RuntimeError(f"AceStepHandler init failed: {msg}")

            logger.info(
                "AceStepHandler initialized: device=%s, config=%s",
                handler.device, config_path,
            )
            return handler

        logger.info("Loading ACE-Step handler model")
        self._handler = await asyncio.to_thread(_load)
        self._model = self._handler  # for is_loaded property

    async def unload_model(self) -> None:
        if self._handler is None:
            return
        self._handler = None
        self._model = None
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            elif torch.backends.mps.is_available():
                torch.mps.empty_cache()
        except Exception:
            pass
        logger.info("ACE-Step handler unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401
            _ensure_vendor_on_path()
            import acestep  # noqa: F401
        except ImportError:
            return False
        return True

    # -- Generation -----------------------------------------------------------

    async def generate(
        self, request: MusicGenerationRequest,
    ) -> MusicGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        if self._handler is None:
            raise RuntimeError("ACE-Step handler not loaded. Check logs.")

        duration = min(request.duration, float(self.config.max_duration))

        logger.info("Generating: %r (%.0fs)", request.prompt[:80], duration)

        wav_bytes, sr, lrc_text = await self._generate(request, duration)

        return MusicGenerationResponse(
            audio_path="",
            audio_data=wav_bytes,
            duration=duration,
            sample_rate=sr,
            format="wav",
            lrc_lyrics=lrc_text,
            metadata={
                "model": "ace-step-handler",
                "prompt": request.prompt[:200],
            },
        )

    async def _generate(
        self, request: MusicGenerationRequest, duration: float,
    ) -> tuple[bytes, int, str | None]:
        handler = self._handler

        def _run() -> tuple[bytes, int, str | None]:
            # Map vocal language codes/names to ACE-Step expectations
            _lang_map = {
                "chinese": "zh", "english": "en", "japanese": "ja",
                "korean": "ko", "spanish": "es", "french": "fr",
                "german": "de", "portuguese": "pt",
            }
            raw_lang = (request.language or "en").lower().strip()
            vocal_lang = _lang_map.get(raw_lang, raw_lang)
            if vocal_lang.startswith("zh"):
                vocal_lang = "zh"

            result = handler.generate_music(
                captions=request.prompt,
                lyrics=request.lyrics or "",
                audio_duration=duration,
                seed=request.seed if request.seed is not None else -1,
                use_random_seed=request.seed is None,
                batch_size=1,
                bpm=request.tempo,
                key_scale=request.musical_key or "",
                vocal_language=vocal_lang,
                shift=3.0,  # recommended for turbo model
                # Style transfer / Cover / Repaint
                reference_audio=request.reference_audio_path,
                src_audio=request.src_audio_path,
                task_type=request.task_type,
                audio_cover_strength=request.audio_cover_strength,
                cover_noise_strength=request.cover_noise_strength,
                repainting_start=request.repainting_start,
                repainting_end=request.repainting_end,
            )

            if not result.get("success"):
                error = result.get("error", "Unknown error")
                raise RuntimeError(f"ACE-Step generation failed: {error}")

            audios = result["audios"]
            if not audios:
                raise RuntimeError("ACE-Step returned no audio")

            audio_tensor = audios[0]["tensor"]
            sr = audios[0].get("sample_rate", 48000)

            wav_bytes, wav_sr = to_wav(audio_tensor, sr)
            # LRC comes from the upstream LLM — no need for ACE-Step to re-infer timestamps
            return wav_bytes, wav_sr, request.lyrics

        try:
            return await asyncio.to_thread(_run)
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                raise RuntimeError(
                    "GPU out of memory. Try reducing duration."
                ) from exc
            raise


