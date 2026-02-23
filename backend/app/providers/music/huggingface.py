from __future__ import annotations

import asyncio
import gc
import io
import logging

from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicGenerationRequest,
    MusicGenerationResponse,
    MusicProviderConfig,
)

logger = logging.getLogger(__name__)

# MusicGen generates ~50 codec frames per second of audio.
_TOKENS_PER_SECOND = 50
# Hard limit from sinusoidal positional embeddings (~30 s).
_MAX_TOKENS = 1503


def _select_device() -> str:
    """Pick the best available torch device: cuda > mps > cpu."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _detect_backend(model_id: str, configured_backend: str) -> str:
    """Detect whether *model_id* should be loaded with transformers or diffusers.

    If ``configured_backend`` is explicitly ``"transformers"`` or ``"diffusers"``
    we honour that.  Otherwise we query HuggingFace Hub model info and fall back
    to ``"transformers"`` when detection is inconclusive.
    """
    if configured_backend in ("transformers", "diffusers"):
        return configured_backend

    try:
        from huggingface_hub import model_info

        info = model_info(model_id)
        library = getattr(info, "library_name", "") or ""
        library_lower = library.lower()

        if "diffusers" in library_lower:
            return "diffusers"
        if library_lower in ("transformers", ""):
            # Also peek at the model card tags for a stronger signal.
            tags = {t.lower() for t in (getattr(info, "tags", None) or [])}
            if "diffusers" in tags:
                return "diffusers"
            return "transformers"

        # Unrecognised library -- default to transformers.
        return "transformers"
    except Exception:
        logger.warning(
            "Could not auto-detect backend for %s, defaulting to transformers",
            model_id,
        )
        return "transformers"


class HuggingFaceMusicProvider(BaseMusicProvider):
    """Generic HuggingFace music provider.

    Supports any text-to-audio model available on HuggingFace Hub.
    Auto-detects whether to use the ``transformers`` pipeline or
    ``diffusers`` ``DiffusionPipeline`` based on model metadata.
    """

    _pipe: object | None = None
    _backend_type: str = "transformers"
    _resolved_device: str = "cpu"

    def __init__(self, config: MusicProviderConfig) -> None:
        super().__init__(config)
        self._pipe = None

    # ------------------------------------------------------------------
    # Model auto-download
    # ------------------------------------------------------------------

    async def _ensure_model_downloaded(self, model_id: str) -> bool:
        """Check if *model_id* is cached locally; download it if not.

        Returns ``True`` if the model is available (already cached or
        successfully downloaded), ``False`` if the download failed.
        """

        def _check_and_download() -> bool:
            from huggingface_hub import scan_cache_dir, snapshot_download

            # Check whether any revision of this repo is already cached.
            try:
                cache_info = scan_cache_dir()
                cached_ids = {
                    repo.repo_id
                    for repo in cache_info.repos
                    if repo.repo_type == "model"
                }
                if model_id in cached_ids:
                    logger.info("Model already cached: %s", model_id)
                    return True
            except Exception:
                # If scanning fails, try downloading anyway.
                logger.debug(
                    "Cache scan failed for %s, proceeding to download",
                    model_id,
                )

            # Not cached -- download.
            logger.info("Model not found in cache, downloading: %s", model_id)
            try:
                snapshot_download(repo_id=model_id)
                logger.info("Model download complete: %s", model_id)
                return True
            except Exception as exc:
                logger.warning(
                    "Failed to download model %s: %s. "
                    "The model load may still succeed if partial files exist.",
                    model_id,
                    exc,
                )
                return False

        return await asyncio.to_thread(_check_and_download)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def load_model(self) -> None:
        model_id = self.config.model_id
        device_cfg = self.config.device or "auto"

        logger.info(
            "HuggingFace provider: loading model=%s device=%s backend=%s",
            model_id,
            device_cfg,
            self.config.backend_type,
        )

        try:
            import torch  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                "PyTorch is required for local music generation. "
                "Install with: pip install hikariwave[gpu]"
            ) from exc

        # Ensure model files are downloaded before loading.
        await self._ensure_model_downloaded(model_id)

        # Resolve device
        if device_cfg == "auto":
            device = _select_device()
        else:
            device = device_cfg
        self._resolved_device = device

        # Detect backend (may query HuggingFace Hub -- blocking I/O)
        self._backend_type = await asyncio.to_thread(
            _detect_backend, model_id, self.config.backend_type,
        )
        logger.info("Detected backend: %s for %s", self._backend_type, model_id)

        if self._backend_type == "diffusers":
            await self._load_diffusers(model_id, device)
        else:
            await self._load_transformers(model_id, device)

    async def _load_transformers(self, model_id: str, device: str) -> None:
        try:
            from transformers import pipeline as hf_pipeline
        except ImportError as exc:
            raise RuntimeError(
                "transformers is required for this model. "
                "Install with: pip install hikariwave[gpu]"
            ) from exc

        def _load() -> object:
            pipe = hf_pipeline(
                "text-to-audio",
                model=model_id,
                device=device,
            )
            return pipe

        self._pipe = await asyncio.to_thread(_load)
        self._model = self._pipe  # marks is_loaded as True
        logger.info("Transformers pipeline loaded: %s on %s", model_id, device)

    async def _load_diffusers(self, model_id: str, device: str) -> None:
        try:
            from diffusers import DiffusionPipeline
        except ImportError as exc:
            raise RuntimeError(
                "diffusers is required for this model. "
                "Install with: pip install hikariwave[gpu]"
            ) from exc

        import torch

        def _load() -> object:
            dtype = torch.float32 if device == "mps" else torch.float16
            pipe = DiffusionPipeline.from_pretrained(
                model_id,
                torch_dtype=dtype,
            )
            pipe = pipe.to(device)
            return pipe

        self._pipe = await asyncio.to_thread(_load)
        self._model = self._pipe
        logger.info("Diffusers pipeline loaded: %s on %s", model_id, device)

    async def unload_model(self) -> None:
        if self._pipe is not None:
            device = self._resolved_device
            del self._pipe
            del self._model
            self._pipe = None
            self._model = None
            gc.collect()
            try:
                import torch

                if device.startswith("cuda") and torch.cuda.is_available():
                    torch.cuda.empty_cache()
                elif device == "mps":
                    torch.mps.empty_cache()
            except Exception:
                pass
        logger.info("HuggingFace music provider unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401
        except ImportError:
            return False
        else:
            return True

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    async def generate(
            self, request: MusicGenerationRequest
    ) -> MusicGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        if self._pipe is None:
            raise RuntimeError(
                f"Music model failed to load: {self.config.model_id}. "
                "Check logs for details."
            )

        if self._backend_type == "diffusers":
            return await self._generate_diffusers(request)
        return await self._generate_transformers(request)

    async def _generate_transformers(
            self, request: MusicGenerationRequest
    ) -> MusicGenerationResponse:
        prompt_text = request.prompt

        # Estimate max_new_tokens from duration.
        clamped_duration = min(request.duration, float(self.config.max_duration))
        max_new_tokens = min(
            int(clamped_duration * _TOKENS_PER_SECOND),
            _MAX_TOKENS,
        )
        if max_new_tokens < int(clamped_duration * _TOKENS_PER_SECOND):
            logger.warning(
                "Duration %.1fs exceeds token limit; clamping to ~%.1fs",
                clamped_duration,
                max_new_tokens / _TOKENS_PER_SECOND,
            )

        logger.info(
            "Generating (transformers): prompt=%r duration=%.1fs tokens=%d",
            prompt_text[:120],
            clamped_duration,
            max_new_tokens,
        )

        def _run() -> tuple[bytes, int]:
            import soundfile as sf

            pipe = self._pipe

            if request.seed is not None:
                import torch

                torch.manual_seed(request.seed)

            result = pipe(
                prompt_text,
                generate_kwargs={
                    "max_new_tokens": max_new_tokens,
                    "do_sample": True,
                    "guidance_scale": 3.0,
                },
            )

            # The pipeline may return a dict or a list of dicts depending
            # on the transformers version.  Handle both formats.
            if isinstance(result, list):
                audio_np = result[0]["audio"]
                sample_rate = result[0]["sampling_rate"]
            else:
                audio_np = result["audio"]
                sample_rate = result["sampling_rate"]

            # Ensure shape is (samples,) or (samples, channels)
            if audio_np.ndim == 2 and audio_np.shape[0] < audio_np.shape[1]:
                audio_np = audio_np.T

            buf = io.BytesIO()
            sf.write(buf, audio_np, sample_rate, format="WAV")
            return buf.getvalue(), sample_rate

        try:
            wav_bytes, sample_rate = await asyncio.to_thread(_run)
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                raise RuntimeError(
                    f"GPU out of memory generating with {self.config.model_id}. "
                    "Try a smaller model or reduce duration."
                ) from exc
            raise

        return MusicGenerationResponse(
            audio_path="",
            audio_data=wav_bytes,
            duration=clamped_duration,
            sample_rate=sample_rate,
            format="wav",
            metadata={
                "model": self.config.model_id,
                "backend": "transformers",
                "device": self._resolved_device,
                "prompt": prompt_text[:200],
            },
        )

    async def _generate_diffusers(
            self, request: MusicGenerationRequest
    ) -> MusicGenerationResponse:
        prompt_text = request.prompt
        duration = min(request.duration, float(self.config.max_duration))

        logger.info(
            "Generating (diffusers): prompt=%r duration=%.1fs",
            prompt_text[:120],
            duration,
        )

        def _run() -> tuple[bytes, int]:
            import numpy as np
            import soundfile as sf
            import torch

            pipe = self._pipe
            generator = None
            if request.seed is not None:
                generator = torch.Generator(device=self._resolved_device)
                generator.manual_seed(request.seed)

            result = pipe(
                prompt_text,
                audio_end_in_s=duration,
                num_inference_steps=100,
                guidance_scale=7.0,
                generator=generator,
            )

            audio_tensor = result.audios[0]

            # Convert to numpy if needed
            if hasattr(audio_tensor, "cpu"):
                audio_np = audio_tensor.cpu().float().numpy()
            else:
                audio_np = np.asarray(audio_tensor, dtype=np.float32)

            # Discover sample rate from the pipeline
            sample_rate = 16000  # safe fallback
            if hasattr(pipe, "vae"):
                vae = pipe.vae
                if hasattr(vae, "sampling_rate"):
                    sample_rate = vae.sampling_rate
                elif hasattr(vae, "config") and hasattr(vae.config, "sampling_rate"):
                    sample_rate = vae.config.sampling_rate
            elif hasattr(pipe, "config") and hasattr(pipe.config, "sample_rate"):
                sample_rate = pipe.config.sample_rate

            # Ensure shape is (samples,) or (samples, channels)
            if audio_np.ndim == 2 and audio_np.shape[0] < audio_np.shape[1]:
                audio_np = audio_np.T

            buf = io.BytesIO()
            sf.write(buf, audio_np, sample_rate, format="WAV")
            return buf.getvalue(), sample_rate

        try:
            wav_bytes, sample_rate = await asyncio.to_thread(_run)
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                raise RuntimeError(
                    f"GPU out of memory generating with {self.config.model_id}. "
                    "Try a smaller model or reduce duration."
                ) from exc
            raise

        return MusicGenerationResponse(
            audio_path="",
            audio_data=wav_bytes,
            duration=duration,
            sample_rate=sample_rate,
            format="wav",
            metadata={
                "model": self.config.model_id,
                "backend": "diffusers",
                "device": self._resolved_device,
                "prompt": prompt_text[:200],
            },
        )
