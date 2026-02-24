"""Music inference service.

Two modes of operation:

1. **Single model** -- delegates directly to ``provider.generate(request)``.
   All HuggingFace models (MusicGen, StableAudio, DiffRhythm, ACE-Step,
   HeartMuLa, …) are loaded uniformly by the provider layer; this service
   simply invokes them.

2. **Composite pipeline** -- combines multiple models to produce a richer
   result (e.g. instrumental model + vocal model, or generation + post-
   processing).  Registered via :meth:`register_pipeline`.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from backend.app.providers.music.base import (
        BaseMusicProvider,
        MusicGenerationRequest,
        MusicGenerationResponse,
    )

logger = logging.getLogger(__name__)


class MusicPipeline(Protocol):
    """Interface for a composite music generation pipeline."""

    async def run(
        self,
        providers: dict[str, BaseMusicProvider],
        request: MusicGenerationRequest,
    ) -> MusicGenerationResponse: ...


class MusicInferenceService:
    """Dispatches music inference.

    * ``infer()`` -- single-model pass-through via the provider.
    * ``run_pipeline()`` -- multi-model composite pipeline.
    """

    def __init__(self) -> None:
        self._pipelines: dict[str, Any] = {}
        self._descriptions: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Single-model inference
    # ------------------------------------------------------------------

    async def infer(
        self,
        provider: BaseMusicProvider,
        request: MusicGenerationRequest,
    ) -> MusicGenerationResponse:
        """Run inference on a single model via its provider."""
        return await provider.generate(request)

    # ------------------------------------------------------------------
    # Composite pipeline
    # ------------------------------------------------------------------

    def register_pipeline(
        self,
        name: str,
        pipeline: MusicPipeline,
        *,
        description: str = "",
    ) -> None:
        """Register a named composite pipeline."""
        self._pipelines[name] = pipeline
        self._descriptions[name] = description
        logger.info("Registered music pipeline: %s", name)

    def list_pipelines(self) -> list[dict[str, str]]:
        """Return metadata for all registered pipelines."""
        return [
            {"name": name, "description": self._descriptions.get(name, "")}
            for name in self._pipelines
        ]

    def resolve_pipeline_providers(
        self,
        pipeline_name: str,
        pipeline_config: dict,
        provider_manager,  # avoid circular import by accepting as param
    ) -> dict[str, BaseMusicProvider]:
        """Resolve provider roles for a pipeline from config.

        *pipeline_config* is the ``music.pipelines.<name>`` section from
        config.yaml, e.g.
        ``{"roles": {"instrumental": "huggingface:musicgen-small",
                      "vocal": "diffrhythm:diffrhythm-full"}}``.
        """
        roles = pipeline_config.get("roles", {})
        providers: dict[str, BaseMusicProvider] = {}
        for role, provider_key in roles.items():
            provider = provider_manager._music.providers.get(provider_key)
            if provider is None:
                raise ValueError(
                    f"Pipeline '{pipeline_name}' role '{role}' references "
                    f"unknown provider: {provider_key!r}"
                )
            providers[role] = provider
        return providers

    async def run_pipeline(
        self,
        name: str,
        providers: dict[str, BaseMusicProvider],
        request: MusicGenerationRequest,
    ) -> MusicGenerationResponse:
        """Run a composite pipeline by name.

        *providers* is a dict of ``{key: loaded_provider}`` that the
        pipeline can draw from (e.g. ``{"instrumental": musicgen_provider,
        "vocal": diffrhythm_provider}``).
        """
        pipeline = self._pipelines.get(name)
        if pipeline is None:
            raise ValueError(
                f"Unknown pipeline: {name!r}.  Available: {self.list_pipelines()}"
            )
        return await pipeline.run(providers, request)


music_inference_service = MusicInferenceService()
