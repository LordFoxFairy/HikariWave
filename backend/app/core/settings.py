from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "HikariWave"
    app_version: str = "0.1.0"
    debug: bool = False

    # API
    api_prefix: str = "/api/v1"
    port: int = 23456
    cors_origins: list[str] = ["*"]

    # Database
    database_url: str = "sqlite+aiosqlite:///./hikariwave.db"

    # Storage
    storage_dir: str = str(Path(__file__).resolve().parent.parent.parent / "storage")
    audio_subdir: str = "audio"
    covers_subdir: str = "covers"

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent.parent.parent / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
