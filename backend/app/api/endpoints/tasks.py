from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.dependencies import get_generation_service
from backend.app.schemas.generation import GenerationResponse
from backend.app.services.music_generation import GenerationService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=GenerationResponse)
async def get_task_status(
    task_id: str,
    svc: GenerationService = Depends(get_generation_service),
):
    gen = await svc.get_by_task_id(task_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return gen


@router.post("/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    svc: GenerationService = Depends(get_generation_service),
):
    gen = await svc.get_by_task_id(task_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Task not found")
    cancelled = await svc.cancel_task(task_id)
    if not cancelled:
        raise HTTPException(status_code=409, detail="Task is not running")
    return {"detail": "Task cancellation requested"}


@router.get("/{task_id}/result", response_model=GenerationResponse)
async def get_task_result(
    task_id: str,
    svc: GenerationService = Depends(get_generation_service),
):
    gen = await svc.get_by_task_id(task_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if gen.status not in ("completed", "failed"):
        raise HTTPException(status_code=202, detail="Task still processing")
    return gen
