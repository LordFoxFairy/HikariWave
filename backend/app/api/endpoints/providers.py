from fastapi import APIRouter

from backend.app.providers.manager import provider_manager

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/llm")
async def list_llm_providers():
    return {"providers": provider_manager.list_llm_providers()}


@router.get("/music")
async def list_music_providers():
    return {"providers": provider_manager.list_music_providers()}


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
