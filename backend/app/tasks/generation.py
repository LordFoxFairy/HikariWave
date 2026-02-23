import asyncio
import logging
from datetime import UTC, datetime

from celery import Celery

from backend.app.core.settings import settings

logger = logging.getLogger(__name__)

celery_app = Celery(
    "hikariwave",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_track_started=True,
)


@celery_app.task(bind=True, name="generate_music")
def generate_music_task(self, task_id: str, params: dict):
    """Celery task that runs music generation on a worker."""
    logger.info("Starting music generation task: %s", task_id)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_generation(task_id, params))
    except Exception as exc:
        logger.exception("Music generation failed: %s", task_id)
        loop.run_until_complete(_mark_failed(task_id, str(exc)))
        raise
    finally:
        loop.close()


async def _run_generation(task_id: str, params: dict) -> None:
    from backend.app.providers.manager import provider_manager
    from backend.app.providers.music.base import MusicGenerationRequest
    from backend.app.repositories.generation import generation_repository

    await generation_repository.update_status(task_id, "processing")

    req = MusicGenerationRequest(**params)
    provider = provider_manager.get_music_provider(req)
    response = await provider.generate(req)

    await generation_repository.update_status(
        task_id,
        "completed",
        audio_path=response.audio_path,
        audio_format=response.format,
        actual_duration=response.duration,
        completed_at=datetime.now(UTC),
    )


async def _mark_failed(task_id: str, error: str) -> None:
    from backend.app.repositories.generation import generation_repository

    await generation_repository.update_status(
        task_id,
        "failed",
        error_message=error[:500],
    )
