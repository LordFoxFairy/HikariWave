import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app.services.music_generation import generation_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/tasks/{task_id}")
async def task_progress_ws(websocket: WebSocket, task_id: str):
    await websocket.accept()
    try:
        while True:
            gen = await generation_service.get_by_task_id(task_id)
            if gen is None:
                await websocket.send_json(
                    {"error": "task not found", "task_id": task_id}
                )
                break
            payload = {
                "task_id": task_id,
                "status": gen.status,
                "progress": gen.progress or 0,
                "message": gen.progress_message or "",
            }
            if gen.status == "completed":
                payload["audio_path"] = gen.audio_path
                payload["duration"] = gen.actual_duration
            elif gen.status == "failed":
                payload["error"] = gen.error_message
            await websocket.send_json(payload)
            if gen.status in ("completed", "failed"):
                break
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: task=%s", task_id)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
