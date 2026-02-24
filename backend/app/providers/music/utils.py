"""Shared utilities for music providers.

Contains common helper functions extracted from individual provider modules
to avoid code duplication.
"""

from __future__ import annotations

import io
from typing import Any

import numpy as np
import soundfile as sf


def select_device() -> str:
    """Select the best available compute device (cuda > mps > cpu)."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def to_wav(audio: Any, sr: int) -> tuple[bytes, int]:
    """Convert audio tensor/array to WAV bytes.

    Handles both PyTorch tensors (with ``.cpu()`` method) and plain
    numpy arrays.  Multi-dimensional arrays are squeezed/transposed
    into the ``(samples, channels)`` layout expected by ``soundfile``.
    """
    if hasattr(audio, "cpu"):
        audio = audio.cpu().float()
        peak = audio.abs().max()
        if peak > 0:
            audio = audio / peak
        audio_np = audio.numpy()
    else:
        audio_np = np.asarray(audio, dtype=np.float32)

    if audio_np.ndim > 2:
        audio_np = audio_np.squeeze(axis=0)
    if audio_np.ndim == 2 and audio_np.shape[0] < audio_np.shape[1]:
        audio_np = audio_np.T

    buf = io.BytesIO()
    sf.write(buf, audio_np, sr, format="WAV")
    return buf.getvalue(), sr
