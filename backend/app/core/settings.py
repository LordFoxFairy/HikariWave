import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "HikariWave"
    app_version: str = "0.1.0"
    debug: bool = True

    # API
    api_prefix: str = "/api/v1"
    port: int = 23456
    cors_origins: list[str] = ["*"]

    # Database
    database_url: str = "sqlite+aiosqlite:///./hikariwave.db"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Storage
    storage_dir: str = str(Path(__file__).resolve().parent.parent.parent / "storage")
    audio_subdir: str = "audio"
    covers_subdir: str = "covers"

    # OpenRouter
    openrouter_api_key: str = os.environ.get("OPENROUTER_API_KEY", "")

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent.parent.parent / ".env")
        env_file_encoding = "utf-8"


settings = Settings()
