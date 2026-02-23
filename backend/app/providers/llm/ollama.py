"""Ollama discovery helpers.

The OllamaProvider class has been removed — Ollama uses the unified
``LLMProvider`` with ``provider_type="openai"`` and base_url pointing to
Ollama's ``/v1`` endpoint.  These standalone helpers are used by the
provider-service layer for Ollama auto-detection.
"""

import logging

import httpx

logger = logging.getLogger(__name__)

OLLAMA_DEFAULT_URL = "http://localhost:11434"


async def detect_ollama(base_url: str = OLLAMA_DEFAULT_URL) -> bool:
    """Check if Ollama is running at the given URL."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def list_ollama_models(base_url: str = OLLAMA_DEFAULT_URL) -> list[str]:
    """List available models from a running Ollama instance."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            if resp.status_code != 200:
                return []
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        logger.exception("Failed to list Ollama models")
        return []
