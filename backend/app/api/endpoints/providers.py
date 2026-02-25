from fastapi import APIRouter, Depends

from backend.app.api.dependencies import get_provider_service
from backend.app.schemas.provider import (
    LLMConfigResponse,
    LLMConfigUpdateRequest,
    LLMTestRequest,
    LLMTestResponse,
    MusicConfigResponse,
    MusicConfigUpdateRequest,
)
from backend.app.services.config_service import ProviderConfigService as ProviderService

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/llm")
async def list_llm_providers(
    svc: ProviderService = Depends(get_provider_service),
):
    return {"providers": await svc.list_llm_providers()}


@router.get("/music")
async def list_music_providers(
    svc: ProviderService = Depends(get_provider_service),
):
    return {"providers": await svc.list_music_providers()}


@router.get("/music/config", response_model=MusicConfigResponse)
async def get_music_config(
    svc: ProviderService = Depends(get_provider_service),
):
    """Get current music configuration (providers + router)."""
    return await svc.get_music_config()


@router.put("/music/config", response_model=MusicConfigResponse)
async def update_music_config(
    body: MusicConfigUpdateRequest,
    svc: ProviderService = Depends(get_provider_service),
):
    """Update music configuration. Persists to config.yaml."""
    providers = [p.model_dump() for p in body.providers]
    return await svc.update_music_config(providers, body.router)


@router.get("/llm/config", response_model=LLMConfigResponse)
async def get_llm_config(
    svc: ProviderService = Depends(get_provider_service),
):
    """Get current LLM configuration (providers + router)."""
    return await svc.get_llm_config()


@router.put("/llm/config", response_model=LLMConfigResponse)
async def update_llm_config(
    body: LLMConfigUpdateRequest,
    svc: ProviderService = Depends(get_provider_service),
):
    """Update LLM configuration (providers + router). Persists to config.yaml."""
    providers = [p.model_dump() for p in body.providers]
    return await svc.update_llm_config(providers, body.router)


@router.post("/llm/test", response_model=LLMTestResponse)
async def test_llm_connection(
    body: LLMTestRequest,
    svc: ProviderService = Depends(get_provider_service),
):
    """Test an LLM provider connection."""
    return await svc.test_llm_connection(
        provider_type=body.type,
        base_url=body.base_url,
        api_key=body.api_key,
        model=body.model,
        provider_name=body.name,
    )
