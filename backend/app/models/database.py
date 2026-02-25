from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import DeclarativeBase


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Generation(Base):
    __tablename__ = "generations"

    id = Column(Integer, primary_key=True)
    task_id = Column(String, unique=True, index=True)
    status = Column(String, default="pending")

    # Input parameters
    prompt = Column(String, nullable=False)
    enhanced_prompt = Column(String, nullable=True)
    lyrics = Column(String, nullable=True)
    lrc_lyrics = Column(String, nullable=True)
    genre = Column(String, nullable=True)
    mood = Column(String, nullable=True)
    duration = Column(Float, default=30.0)
    title = Column(String, nullable=True)
    tempo = Column(Integer, nullable=True)
    musical_key = Column(String, nullable=True)
    instruments = Column(JSON, nullable=True)
    language = Column(String, default="en")
    instrumental = Column(Integer, default=0)

    # Provider info
    llm_provider = Column(String, nullable=True)
    music_provider = Column(String, nullable=False)

    # Output
    audio_path = Column(String, nullable=True)
    audio_format = Column(String, default="wav")
    actual_duration = Column(Float, nullable=True)
    cover_art_path = Column(String, nullable=True)
    cover_art_prompt = Column(String, nullable=True)

    # Lineage -- extend or remix
    parent_id = Column(Integer, ForeignKey("generations.id"), nullable=True)
    parent_type = Column(String, nullable=True)

    # Progress
    progress = Column(Integer, default=0)
    progress_message = Column(String, nullable=True)

    # User interaction
    is_liked = Column(Integer, default=0)

    # Metadata
    generation_params = Column(JSON, default=dict)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)
