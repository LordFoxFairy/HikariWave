from fastapi import APIRouter

from backend.app.api.endpoints import audio, covers, generate, history, providers, tasks
from backend.app.api.websocket import router as ws_router

api_router = APIRouter()

api_router.include_router(generate.router)
api_router.include_router(tasks.router)
api_router.include_router(history.router)
api_router.include_router(providers.router)
api_router.include_router(audio.router)
api_router.include_router(covers.router)
api_router.include_router(ws_router)
