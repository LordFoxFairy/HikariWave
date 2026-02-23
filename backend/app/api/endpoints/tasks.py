from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.schemas.generation import GenerationResponse
from backend.app.services.generation import generation_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=GenerationResponse)
async def get_task_status(
    task_id: str,
    db: AsyncSession = Depends(get_db),
):
    gen = await generation_service.get_by_task_id(db, task_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return gen


@router.get("/{task_id}/result", response_model=GenerationResponse)
async def get_task_result(
    task_id: str,
    db: AsyncSession = Depends(get_db),
):
    gen = await generation_service.get_by_task_id(db, task_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if gen.status not in ("completed", "failed"):
        raise HTTPException(status_code=202, detail="Task still processing")
    return gen
