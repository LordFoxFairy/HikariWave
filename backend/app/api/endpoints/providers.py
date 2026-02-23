from fastapi import APIRouter, Depends

from backend.app.api.dependencies import get_provider_service
from backend.app.services.provider_service import ProviderService

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/llm")
async def list_llm_providers(
    svc: ProviderService = Depends(get_provider_service),
):
    return {"providers": svc.list_llm_providers()}


@router.get("/music")
async def list_music_providers(
    svc: ProviderService = Depends(get_provider_service),
):
    return {"providers": svc.list_music_providers()}


@router.put("/llm/active")
async def set_active_llm(provider_name: str, model_name: str | None = None):
    # TODO: persist selection in DB and reload router
    return {
        "detail": "not yet implemented",
        "provider_name": provider_name,
        "model_name": model_name,
    }


@router.put("/music/active")
async def set_active_music(provider_name: str):
    # TODO: persist selection in DB and reload router
    return {
        "detail": "not yet implemented",
        "provider_name": provider_name,
    }


@router.get("/image")
async def list_image_providers(
    svc: ProviderService = Depends(get_provider_service),
):
    return {"providers": svc.list_image_providers()}
