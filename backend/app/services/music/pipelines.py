"""Built-in composite pipelines for multi-model music generation."""

from __future__ import annotations

import asyncio
import io
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.app.providers.music.base import (
        BaseMusicProvider,
        MusicGenerationRequest,
        MusicGenerationResponse,
    )
    from backend.app.services.music.inference import MusicInferenceService

logger = logging.getLogger(__name__)


class DirectPipeline:
    """Single-model pass-through pipeline.

    Expects *providers* dict with key ``"model"`` -- the single provider
    to invoke.  This makes the default single-model path go through
    the same pipeline system as composite strategies.
    """

    async def run(
        self,
        providers: dict[str, BaseMusicProvider],
        request: MusicGenerationRequest,
    ) -> MusicGenerationResponse:
        provider = providers.get("model")
        if provider is None:
            raise ValueError("DirectPipeline requires a 'model' provider")
        return await provider.generate(request)


class VocalInstrumentalPipeline:
    """Combines an instrumental model with a vocal model.

    Expects *providers* dict with keys:

    - ``"instrumental"`` -- provider for accompaniment generation
    - ``"vocal"`` -- provider for vocal/singing generation

    Both are run in parallel.  The resulting audio is mixed by
    overlaying the vocal track on the instrumental track.
    """

    def __init__(
        self,
        vocal_volume: float = 0.7,
        instrumental_volume: float = 0.5,
    ) -> None:
        self.vocal_volume = vocal_volume
        self.instrumental_volume = instrumental_volume

    async def run(
        self,
        providers: dict[str, BaseMusicProvider],
        request: MusicGenerationRequest,
    ) -> MusicGenerationResponse:
        from backend.app.providers.music.base import (
            MusicGenerationResponse,
        )

        instrumental_provider = providers.get("instrumental")
        vocal_provider = providers.get("vocal")

        if instrumental_provider is None or vocal_provider is None:
            raise ValueError(
                "VocalInstrumentalPipeline requires both "
                "'instrumental' and 'vocal' providers"
            )

        # Build requests: instrumental gets no lyrics,
        # vocal gets the full request.
        instrumental_req = request.model_copy(
            update={"instrumental": True, "lyrics": None},
        )

        # Run both in parallel
        instrumental_result, vocal_result = await asyncio.gather(
            instrumental_provider.generate(instrumental_req),
            vocal_provider.generate(request),
        )

        # Mix the two audio tracks
        mixed_bytes, sample_rate = await asyncio.to_thread(
            self._mix_audio,
            instrumental_result.audio_data,
            instrumental_result.sample_rate,
            vocal_result.audio_data,
            vocal_result.sample_rate,
        )

        return MusicGenerationResponse(
            audio_path="",
            audio_data=mixed_bytes,
            duration=max(
                instrumental_result.duration,
                vocal_result.duration,
            ),
            sample_rate=sample_rate,
            format="wav",
            metadata={
                "pipeline": "vocal_instrumental",
                "instrumental_model": (instrumental_provider.config.model_id),
                "vocal_model": vocal_provider.config.model_id,
            },
        )

    # ------------------------------------------------------------------
    # Audio mixing helper
    # ------------------------------------------------------------------

    def _mix_audio(
        self,
        audio_a: bytes | None,
        sr_a: int,
        audio_b: bytes | None,
        sr_b: int,
    ) -> tuple[bytes, int]:
        """Mix two WAV byte buffers.

        Returns ``(mixed_wav_bytes, sample_rate)``.
        """
        import numpy as np
        import soundfile as sf

        if audio_a is None or audio_b is None:
            return (audio_a or audio_b or b""), sr_a or sr_b

        # Read both tracks
        arr_a, _ = sf.read(io.BytesIO(audio_a), dtype="float32")
        arr_b, _ = sf.read(io.BytesIO(audio_b), dtype="float32")

        # Ensure mono for simplicity
        if arr_a.ndim > 1:
            arr_a = arr_a.mean(axis=1)
        if arr_b.ndim > 1:
            arr_b = arr_b.mean(axis=1)

        # Resample if different sample rates (simple approach:
        # use the higher rate, linearly interpolate the lower).
        target_sr = max(sr_a, sr_b)
        if sr_a != target_sr:
            new_len = int(len(arr_a) * target_sr / sr_a)
            arr_a = np.interp(
                np.linspace(0, len(arr_a), new_len),
                np.arange(len(arr_a)),
                arr_a,
            ).astype(np.float32)
        if sr_b != target_sr:
            new_len = int(len(arr_b) * target_sr / sr_b)
            arr_b = np.interp(
                np.linspace(0, len(arr_b), new_len),
                np.arange(len(arr_b)),
                arr_b,
            ).astype(np.float32)

        # Pad shorter track to match length
        max_len = max(len(arr_a), len(arr_b))
        if len(arr_a) < max_len:
            arr_a = np.pad(arr_a, (0, max_len - len(arr_a)))
        if len(arr_b) < max_len:
            arr_b = np.pad(arr_b, (0, max_len - len(arr_b)))

        # Mix with volume levels
        mixed = arr_a * self.instrumental_volume + arr_b * self.vocal_volume

        # Normalize to prevent clipping
        peak = np.abs(mixed).max()
        if peak > 1.0:
            mixed = mixed / peak

        buf = io.BytesIO()
        sf.write(buf, mixed, target_sr, format="WAV")
        return buf.getvalue(), target_sr


def register_builtin_pipelines(
    service: MusicInferenceService,
) -> None:
    """Register built-in composite pipelines."""
    service.register_pipeline(
        "direct",
        DirectPipeline(),
        description="Single model pass-through (uses the configured default model)",
    )
    service.register_pipeline(
        "vocal_instrumental",
        VocalInstrumentalPipeline(),
        description="Combines instrumental and vocal models in parallel, then mixes",
    )
