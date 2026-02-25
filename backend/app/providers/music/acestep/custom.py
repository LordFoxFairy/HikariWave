"""ACE-Step music provider (native / self-assembly).

Loads the ACE-Step v1.5 multi-component model from HuggingFace:

* **DiT** (diffusion transformer) — ``AutoModel`` with ``trust_remote_code``
* **VAE** (AutoencoderOobleck) — decodes latents to 48 kHz stereo audio
* **Text encoder** (Qwen3-Embedding-0.6B) — encodes text/lyrics prompts
* **Silence latent** — initialisation tensor for generation

All weights live in the same HuggingFace repo (``ACE-Step/Ace-Step1.5``)
under sibling subdirectories.  The ``subfolder`` model_kwarg tells the
provider which subdirectory holds the DiT code + config.

Configurable via ``config.yaml``::

    - name: acestep
      type: acestep
      models:
        - name: ace-step-v1.5
          model_id: ACE-Step/Ace-Step1.5
          model_kwargs:
            subfolder: acestep-v15-turbo
"""

from __future__ import annotations

import asyncio
import gc
import logging
from pathlib import Path
from typing import Any

from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicGenerationRequest,
    MusicGenerationResponse,
    MusicProviderConfig,
)
from backend.app.providers.music.utils import select_device, to_wav
from backend.app.utils.lrc import lrc_to_plain

logger = logging.getLogger(__name__)

# ACE-Step latent space runs at 25 Hz (48000 / 1920 hop)
_LATENT_RATE = 25
_LATENT_CHANNELS = 64
_SAMPLE_RATE = 48000


# -- Component loaders --------------------------------------------------------


def _resolve_snapshot(model_id: str) -> Path:
    """Return local snapshot path for *model_id* (no download)."""
    from huggingface_hub import snapshot_download

    return Path(snapshot_download(repo_id=model_id, local_files_only=True))


def _load_dit(
    snapshot: Path, subfolder: str, dtype: Any, device: str, **kwargs: Any,
) -> Any:
    """Load the DiT (diffusion transformer) via ``AutoModel``."""
    import torch
    from transformers import AutoModel

    model_path = snapshot / subfolder
    if not model_path.is_dir():
        raise FileNotFoundError(
            f"Subfolder '{subfolder}' not found in {snapshot}. "
            "Check model_kwargs.subfolder in config.yaml."
        )

    model = AutoModel.from_pretrained(
        str(model_path), torch_dtype=dtype, trust_remote_code=True, **kwargs,
    ).to(device)
    model.eval()
    logger.info("Loaded DiT from %s", model_path)
    return model


def _load_vae(snapshot: Path, dtype: Any, device: str) -> Any:
    """Load AutoencoderOobleck from the ``vae/`` subdirectory."""
    import torch
    from diffusers import AutoencoderOobleck

    vae_path = snapshot / "vae"
    if not vae_path.is_dir():
        logger.warning("VAE directory not found: %s", vae_path)
        return None

    vae_dtype = torch.bfloat16 if device == "cuda" else dtype
    vae = AutoencoderOobleck.from_pretrained(str(vae_path)).to(device).to(vae_dtype)
    vae.eval()
    logger.info("Loaded VAE from %s", vae_path)
    return vae


def _load_text_encoder(snapshot: Path, dtype: Any, device: str) -> tuple[Any, Any]:
    """Load text encoder + tokenizer from ``Qwen3-Embedding-0.6B/``."""
    from transformers import AutoModel, AutoTokenizer

    enc_path = snapshot / "Qwen3-Embedding-0.6B"
    if not enc_path.is_dir():
        logger.warning("Text encoder directory not found: %s", enc_path)
        return None, None

    tokenizer = AutoTokenizer.from_pretrained(str(enc_path))
    encoder = AutoModel.from_pretrained(
        str(enc_path), attn_implementation="sdpa", torch_dtype=dtype,
    ).to(device)
    encoder.eval()
    logger.info("Loaded text encoder from %s", enc_path)
    return encoder, tokenizer


def _load_silence_latent(snapshot: Path, dtype: Any, device: str) -> Any:
    """Load ``silence_latent.pt`` from any subdirectory."""
    import torch

    for subdir in snapshot.iterdir():
        sl_path = subdir / "silence_latent.pt"
        if sl_path.exists():
            tensor = (
                torch.load(str(sl_path), weights_only=True)
                .transpose(1, 2)  # [1, C, T] -> [1, T, C]
                .to(device)
                .to(dtype)
            )
            logger.info("Loaded silence_latent from %s", sl_path)
            return tensor
    logger.warning("silence_latent.pt not found in %s", snapshot)
    return None


# -- Provider -----------------------------------------------------------------


class AceStepMusicProvider(BaseMusicProvider):
    """Provider for ACE-Step vocal music generation.

    Components are loaded from sibling directories within the same
    HuggingFace snapshot.  Generation produces 48 kHz stereo WAV.
    """

    def __init__(self, config: MusicProviderConfig) -> None:
        super().__init__(config)
        self._device: str = "cpu"
        self._vae: Any = None
        self._text_encoder: Any = None
        self._text_tokenizer: Any = None
        self._silence_latent: Any = None

    # -- Lifecycle ------------------------------------------------------------

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

        def _load() -> Any:
            dtype = torch.float32 if self._device == "mps" else torch.float16
            kwargs = dict(self.config.model_kwargs)
            subfolder = kwargs.pop("subfolder", "acestep-v15-turbo")

            snapshot = _resolve_snapshot(model_id)

            # Load all components
            model = _load_dit(
                snapshot, subfolder, dtype, self._device, **kwargs,
            )
            self._vae = _load_vae(snapshot, dtype, self._device)
            self._text_encoder, self._text_tokenizer = _load_text_encoder(
                snapshot, dtype, self._device,
            )
            self._silence_latent = _load_silence_latent(
                snapshot, dtype, self._device,
            )
            return model

        logger.info("Loading ACE-Step model=%s device=%s", model_id, self._device)
        self._model = await asyncio.to_thread(_load)

    async def unload_model(self) -> None:
        if self._model is None:
            return
        device = self._device
        for attr in (
            "_model", "_vae", "_text_encoder",
            "_text_tokenizer", "_silence_latent",
        ):
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
        logger.info("ACE-Step model unloaded")

    async def health_check(self) -> bool:
        try:
            import torch  # noqa: F401
        except ImportError:
            return False
        return True

    # -- Generation -----------------------------------------------------------

    async def generate(
        self, request: MusicGenerationRequest,
    ) -> MusicGenerationResponse:
        if not self.is_loaded:
            await self.load_model()

        if self._model is None:
            raise RuntimeError(
                f"Model failed to load: {self.config.model_id}. Check logs."
            )
        if self._vae is None:
            raise RuntimeError("VAE not loaded — cannot decode audio.")

        duration = min(request.duration, float(self.config.max_duration))

        logger.info("Generating: %r (%.0fs)", request.prompt[:80], duration)

        wav_bytes, sr = await self._generate(request, duration)

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

    async def _generate(
        self, request: MusicGenerationRequest, duration: float,
    ) -> tuple[bytes, int]:
        def _run() -> tuple[bytes, int]:
            import torch

            model = self._model
            vae = self._vae
            dtype = next(model.parameters()).dtype
            device = self._device

            # Encode text prompt and lyrics
            text_hidden, text_mask = self._encode_text(request.prompt)
            # Strip LRC timestamps — text encoder needs plain text
            plain_lyrics = lrc_to_plain(request.lyrics) if request.lyrics else ""
            lyric_hidden, lyric_mask = self._encode_text(plain_lyrics)

            # Latent space: 25 Hz, 64 channels
            n_frames = int(duration * _LATENT_RATE)
            pool_ws = getattr(model.config, "pool_window_size", 5)
            n_frames = max(n_frames, pool_ws)
            n_frames = (n_frames // pool_ws) * pool_ws

            src_latents = torch.zeros(
                1, n_frames, _LATENT_CHANNELS, dtype=dtype, device=device,
            )
            chunk_masks = torch.ones(
                1, n_frames, _LATENT_CHANNELS, dtype=dtype, device=device,
            )
            is_covers = torch.zeros(1, dtype=torch.long, device=device)
            attention_mask = torch.ones(1, n_frames, dtype=dtype, device=device)

            silence = self._silence_latent
            if silence is None:
                silence = torch.zeros(
                    1, n_frames, _LATENT_CHANNELS, dtype=dtype, device=device,
                )

            # No reference audio — single dummy segment
            refer_packed = torch.zeros(
                1, 1, _LATENT_CHANNELS, dtype=dtype, device=device,
            )
            refer_order = torch.zeros(1, dtype=torch.long, device=device)

            # DiT inference
            with torch.no_grad():
                result = model.generate_audio(
                    text_hidden_states=text_hidden,
                    text_attention_mask=text_mask,
                    lyric_hidden_states=lyric_hidden,
                    lyric_attention_mask=lyric_mask,
                    refer_audio_acoustic_hidden_states_packed=refer_packed,
                    refer_audio_order_mask=refer_order,
                    src_latents=src_latents,
                    chunk_masks=chunk_masks,
                    is_covers=is_covers,
                    silence_latent=silence,
                    attention_mask=attention_mask,
                    seed=request.seed if request.seed is not None else -1,
                )

            # Decode latents → audio via VAE
            target_latents = result["target_latents"]
            if target_latents.ndim == 3:
                target_latents = target_latents.transpose(1, 2)  # [B,T,C] → [B,C,T]

            with torch.no_grad():
                audio = vae.decode(target_latents.to(vae.dtype)).sample

            return to_wav(audio[0], _SAMPLE_RATE)

        try:
            return await asyncio.to_thread(_run)
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                raise RuntimeError(
                    f"GPU out of memory with {self.config.model_id}. "
                    "Try reducing duration."
                ) from exc
            raise

    def _encode_text(self, text: str) -> tuple[Any, Any]:
        """Encode text using Qwen3-Embedding text encoder."""
        import torch

        if self._text_encoder is None or self._text_tokenizer is None:
            dtype = next(self._model.parameters()).dtype
            hidden = torch.zeros(
                1, 1, 1024, dtype=dtype, device=self._device,
            )
            mask = torch.ones(1, 1, dtype=dtype, device=self._device)
            return hidden, mask

        tokens = self._text_tokenizer(
            text, return_tensors="pt", padding=True,
            truncation=True, max_length=512,
        ).to(self._device)

        with torch.no_grad():
            outputs = self._text_encoder(**tokens)

        hidden = outputs.last_hidden_state
        mask = tokens["attention_mask"].to(hidden.dtype)
        return hidden, mask


