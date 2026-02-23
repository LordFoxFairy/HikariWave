import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from backend.app.api.router import api_router
from backend.app.core.settings import settings
from backend.app.db.session import engine
from backend.app.models.database import Base, Generation
from backend.app.providers.manager import provider_manager

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting HikariWave backend v%s", settings.app_version)
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Mark orphan "processing" generations as failed (server restart)
    async with engine.begin() as conn:
        await conn.execute(
            update(Generation)
            .where(Generation.status.in_(["pending", "processing"]))
            .values(
                status="failed",
                error_message="Server restarted during generation",
                progress=0,
                progress_message="Server restarted",
            )
        )
    # Load provider config
    provider_manager.load_config()
    # Preload music model in background (non-blocking)
    preload_task = asyncio.create_task(
        provider_manager.preload_music_model()
    )
    yield
    # Shutdown: cancel preload if still running
    preload_task.cancel()
    # Unload music model if loaded
    try:
        provider = provider_manager.get_music_provider()
        if provider.is_loaded:
            await provider.unload_model()
    except Exception:
        pass
    await engine.dispose()
    logger.info("HikariWave backend stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)
