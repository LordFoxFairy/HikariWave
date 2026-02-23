from datetime import datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    Integer,
    String,
)
from sqlalchemy.orm import DeclarativeBase


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
    genre = Column(String, nullable=True)
    mood = Column(String, nullable=True)
    duration = Column(Float, default=30.0)

    # Provider info
    llm_provider = Column(String, nullable=True)
    music_provider = Column(String, nullable=False)

    # Output
    audio_path = Column(String, nullable=True)
    audio_format = Column(String, default="wav")
    actual_duration = Column(Float, nullable=True)

    # Metadata
    generation_params = Column(JSON, default=dict)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class ProviderConfig(Base):
    __tablename__ = "provider_configs"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    provider_type = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    is_active = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
