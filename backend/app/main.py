import os

# Migrate deprecated TRANSFORMERS_CACHE to HF_HOME before transformers is imported.
_tc = os.environ.pop("TRANSFORMERS_CACHE", None)
if _tc and "HF_HOME" not in os.environ:
    os.environ["HF_HOME"] = _tc

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text, update

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


def _auto_migrate(connection) -> None:
    """Add any missing columns to existing tables.

    This is a lightweight migration for development — it inspects the DB
    schema and runs ALTER TABLE for columns defined in the model but
    missing from the database.
    """
    insp = inspect(connection)
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing_cols = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = col.type.compile(dialect=connection.dialect)
                nullable = "NULL" if col.nullable else "NOT NULL"
                default = ""
                if col.default is not None:
                    default = f" DEFAULT {col.default.arg!r}"
                sql = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type} {nullable}{default}"
                logger.info("Auto-migrate: %s", sql)
                connection.execute(text(sql))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting HikariWave backend v%s", settings.app_version)
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Auto-migrate: add missing columns to existing tables
    async with engine.begin() as conn:
        await conn.run_sync(_auto_migrate)
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
    # Models are downloaded on-demand via the marketplace/providers API
    yield
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
