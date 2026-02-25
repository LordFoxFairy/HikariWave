from fastapi import APIRouter

from backend.app.api.endpoints import (
    audio,
    covers,
    generate,
    history,
    lyrics,
    marketplace,
    providers,
    tasks,
)
from backend.app.api.websocket import router as ws_router
from backend.app.core.settings import settings

api_router = APIRouter()

api_router.include_router(generate.router)
api_router.include_router(tasks.router)
api_router.include_router(history.router)
api_router.include_router(providers.router)
api_router.include_router(audio.router)
api_router.include_router(lyrics.router)
api_router.include_router(covers.router)
api_router.include_router(marketplace.router)
api_router.include_router(ws_router)


@api_router.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "version": settings.app_version,
    }
