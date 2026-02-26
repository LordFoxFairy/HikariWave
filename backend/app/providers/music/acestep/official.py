"""ACE-Step Handler provider.

Uses the official ``ace-step`` package (``AceStepHandler``) for music
generation.  This provider delegates all model loading, text encoding,
diffusion, and VAE decoding to the handler — no manual component
assembly required.

When ``lm_model_path`` is set in ``model_kwargs``, the 5Hz Language
Model is loaded alongside the DiT to enable Chain-of-Thought reasoning
— dramatically improving song structure, lyrics alignment, and overall
generation quality.

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
            # 5Hz LM — enables CoT reasoning for much higher quality
            lm_model_path: acestep-5Hz-lm-4B
            lm_backend: mlx
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

    When the 5Hz LM is configured, generation uses the full
    ``inference.generate_music`` pipeline (LM → DiT) instead of the
    DiT-only ``handler.generate_music`` path.
    """

    def __init__(self, config: MusicProviderConfig) -> None:
        super().__init__(config)
        self._handler: Any = None
        self._llm_handler: Any = None  # 5Hz LM handler

    # -- Lifecycle ------------------------------------------------------------

    async def load_model(self) -> None:
        def _load() -> tuple[Any, Any]:
            _ensure_vendor_on_path()
            from acestep.handler import AceStepHandler

            handler = AceStepHandler()

            kwargs = dict(self.config.model_kwargs)
            config_path = kwargs.pop("config_path", "acestep-v15-turbo")
            device = kwargs.pop("device", "auto")
            use_mlx_dit = kwargs.pop("use_mlx_dit", True)

            # Pop LM-specific kwargs before passing rest to DiT
            lm_model_path = kwargs.pop("lm_model_path", None)
            lm_backend = kwargs.pop("lm_backend", "mlx")

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

            # Initialize 5Hz LM if configured
            llm_handler = None
            if lm_model_path:
                llm_handler = _init_llm(
                    lm_model_path, lm_backend, device,
                )

            return handler, llm_handler

        logger.info("Loading ACE-Step handler model")
        self._handler, self._llm_handler = await asyncio.to_thread(_load)
        self._model = self._handler  # for is_loaded property

    async def unload_model(self) -> None:
        if self._handler is None:
            return
        if self._llm_handler is not None:
            try:
                self._llm_handler.unload()
            except Exception:
                pass
            self._llm_handler = None
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
        await self.ensure_loaded()

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
                "lm_enabled": self._llm_handler is not None,
            },
        )

    async def _generate(
        self, request: MusicGenerationRequest, duration: float,
    ) -> tuple[bytes, int, str | None]:
        handler = self._handler
        llm_handler = self._llm_handler

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

            use_lm = (
                llm_handler is not None
                and llm_handler.llm_initialized
                and request.task_type not in ("cover", "repaint")
            )

            if use_lm:
                return _generate_with_lm(
                    handler, llm_handler, request,
                    duration, vocal_lang,
                )

            return _generate_dit_only(
                handler, request, duration, vocal_lang,
            )

        try:
            return await asyncio.to_thread(_run)
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                raise RuntimeError(
                    "GPU out of memory. Try reducing duration."
                ) from exc
            raise


# -- Module-level helpers -----------------------------------------------------


_KNOWN_LM_REPOS: dict[str, str] = {
    "acestep-5Hz-lm-0.6B": "ACE-Step/acestep-5Hz-lm-0.6B",
    "acestep-5Hz-lm-1.7B": "ACE-Step/acestep-5Hz-lm-1.7B",
    "acestep-5Hz-lm-4B": "ACE-Step/acestep-5Hz-lm-4B",
}


def _init_llm(
    lm_model_path: str, lm_backend: str, device: str,
) -> Any:
    """Initialize the 5Hz LLMHandler, downloading weights if needed.

    When ``lm_model_path`` matches a known repo, the weights are fetched
    via ``huggingface_hub.snapshot_download`` into the standard HF cache
    and a symlink is created under ``checkpoints/`` so the vendor code
    can find them at the expected relative path.
    """
    from acestep.llm_inference import LLMHandler

    checkpoint_dir = Path(_VENDOR_DIR) / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    target = checkpoint_dir / lm_model_path

    if not target.exists():
        repo_id = _KNOWN_LM_REPOS.get(lm_model_path)
        if repo_id:
            from huggingface_hub import snapshot_download

            logger.info("Downloading LM %s from HF cache …", repo_id)
            cache_path = snapshot_download(repo_id=repo_id)
            target.symlink_to(cache_path)
            logger.info("Symlinked %s → %s", target, cache_path)
        else:
            # Fallback: use vendor downloader for unknown model names
            try:
                from acestep.model_downloader import ensure_lm_model

                dl_ok, dl_msg = ensure_lm_model(
                    model_name=lm_model_path,
                    checkpoints_dir=str(checkpoint_dir),
                )
                if not dl_ok:
                    logger.warning("LM model download issue: %s", dl_msg)
            except Exception:
                logger.exception("Failed to ensure LM model download")

    llm = LLMHandler()
    status, ok = llm.initialize(
        checkpoint_dir=str(checkpoint_dir),
        lm_model_path=lm_model_path,
        backend=lm_backend,
        device=device,
        offload_to_cpu=False,
    )
    if ok:
        logger.info("5Hz LM initialized: %s", status)
    else:
        logger.warning("5Hz LM failed to initialize: %s", status)
        return None
    return llm


def _generate_with_lm(
    handler: Any,
    llm_handler: Any,
    request: MusicGenerationRequest,
    duration: float,
    vocal_lang: str,
) -> tuple[bytes, int, str | None]:
    """Generate using the full LM → DiT pipeline."""
    from acestep.inference import (
        GenerationConfig,
        GenerationParams,
        generate_music,
    )

    params = GenerationParams(
        caption=request.prompt,
        lyrics=request.lyrics or "",
        instrumental=request.instrumental,
        duration=duration,
        bpm=request.tempo,
        keyscale=request.musical_key or "",
        vocal_language=vocal_lang,
        seed=request.seed if request.seed is not None else -1,
        shift=3.0,
        # Task-specific
        task_type=request.task_type,
        reference_audio=request.reference_audio_path,
        src_audio=request.src_audio_path,
        audio_cover_strength=request.audio_cover_strength,
        cover_noise_strength=request.cover_noise_strength,
        repainting_start=request.repainting_start,
        repainting_end=(
            request.repainting_end
            if request.repainting_end is not None
            else -1
        ),
        # Enable LM Chain-of-Thought reasoning
        thinking=True,
        use_cot_caption=True,
        use_cot_language=True,
        use_cot_metas=True,
    )

    config = GenerationConfig(
        batch_size=1,
        use_random_seed=request.seed is None,
        seeds=(
            [request.seed] if request.seed is not None else None
        ),
    )

    result = generate_music(
        dit_handler=handler,
        llm_handler=llm_handler,
        params=params,
        config=config,
    )

    if not result.success:
        raise RuntimeError(
            f"ACE-Step generation failed: {result.error}"
        )
    if not result.audios:
        raise RuntimeError("ACE-Step returned no audio")

    audio_entry = result.audios[0]
    # inference.generate_music returns audio as file paths or tensors
    # depending on save_dir; without save_dir we get tensor in the dict
    audio_tensor = audio_entry.get("tensor")
    audio_path = audio_entry.get("path") or audio_entry.get("audio_path")
    sr = audio_entry.get("sample_rate", 48000)

    if audio_tensor is not None:
        wav_bytes, wav_sr = to_wav(audio_tensor, sr)
    elif audio_path:
        wav_bytes = Path(audio_path).read_bytes()
        wav_sr = sr
    else:
        raise RuntimeError("ACE-Step returned no audio data")

    return wav_bytes, wav_sr, request.lyrics


def _generate_dit_only(
    handler: Any,
    request: MusicGenerationRequest,
    duration: float,
    vocal_lang: str,
) -> tuple[bytes, int, str | None]:
    """Generate using DiT-only path (no LM, fallback for cover/repaint)."""
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
        shift=3.0,
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
    return wav_bytes, wav_sr, request.lyrics
