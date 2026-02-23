from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, or_, select

from backend.app.db.session import async_session_factory
from backend.app.models.database import Generation

logger = logging.getLogger(__name__)


class GenerationRepository:
    """Encapsulates all SQLAlchemy queries for the Generation model.

    Each method manages its own session via async_session_factory.
    """

    async def create(self, **kwargs: Any) -> Generation:
        async with async_session_factory() as db:
            gen = Generation(**kwargs)
            db.add(gen)
            await db.flush()
            # Eagerly load all attributes before the session closes
            await db.refresh(gen)
            await db.commit()
            return gen

    async def get_by_id(self, generation_id: int) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            return result.scalar_one_or_none()

    async def get_by_task_id(self, task_id: str) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.task_id == task_id)
            )
            return result.scalar_one_or_none()

    async def list_all(
        self,
        offset: int = 0,
        limit: int = 50,
        search: str | None = None,
        is_liked: bool | None = None,
        genre: str | None = None,
        mood: str | None = None,
        status: str | None = None,
        sort: str = "created_at",
        sort_dir: str = "desc",
    ) -> tuple[list[Generation], int]:
        async with async_session_factory() as db:
            # Build shared filter conditions
            conditions = []
            if search:
                pattern = f"%{search}%"
                conditions.append(
                    or_(
                        Generation.title.ilike(pattern),
                        Generation.prompt.ilike(pattern),
                        Generation.genre.ilike(pattern),
                        Generation.mood.ilike(pattern),
                    )
                )
            if is_liked is not None:
                conditions.append(Generation.is_liked == (1 if is_liked else 0))
            if genre:
                conditions.append(Generation.genre.ilike(f"%{genre}%"))
            if mood:
                conditions.append(Generation.mood.ilike(f"%{mood}%"))
            if status:
                conditions.append(Generation.status == status)

            # Count query with filters
            count_q = select(func.count()).select_from(Generation)
            if conditions:
                count_q = count_q.where(*conditions)
            total = (await db.execute(count_q)).scalar() or 0

            # Resolve sort column
            sort_columns = {
                "created_at": Generation.created_at,
                "title": Generation.title,
                "actual_duration": Generation.actual_duration,
            }
            sort_col = sort_columns.get(sort, Generation.created_at)
            order = sort_col.asc() if sort_dir == "asc" else sort_col.desc()

            # Data query with filters, sorting, and pagination
            q = select(Generation)
            if conditions:
                q = q.where(*conditions)
            q = q.order_by(order).offset(offset).limit(limit)

            rows = (await db.execute(q)).scalars().all()
            return list(rows), total

    async def delete(self, generation_id: int) -> bool:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            gen = result.scalar_one_or_none()
            if gen is None:
                return False
            await db.delete(gen)
            await db.commit()
            return True

    async def update(self, task_id: str, **fields: Any) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.task_id == task_id)
            )
            gen = result.scalar_one_or_none()
            if gen is None:
                return None
            for key, value in fields.items():
                setattr(gen, key, value)
            await db.commit()
            await db.refresh(gen)
            return gen

    async def update_status(
        self, task_id: str, status: str, **extra_fields: Any
    ) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.task_id == task_id)
            )
            gen = result.scalar_one_or_none()
            if gen is None:
                return None
            gen.status = status
            for key, value in extra_fields.items():
                setattr(gen, key, value)
            await db.commit()
            await db.refresh(gen)
            return gen

    async def update_cover_art(
        self, task_id: str, cover_art_path: str, cover_art_prompt: str
    ) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.task_id == task_id)
            )
            gen = result.scalar_one_or_none()
            if gen is None:
                return None
            gen.cover_art_path = cover_art_path
            gen.cover_art_prompt = cover_art_prompt
            await db.commit()
            await db.refresh(gen)
            return gen

    async def update_cover_art_by_id(
        self, generation_id: int, cover_art_path: str, cover_art_prompt: str
    ) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            gen = result.scalar_one_or_none()
            if gen is None:
                return None
            gen.cover_art_path = cover_art_path
            gen.cover_art_prompt = cover_art_prompt
            await db.commit()
            await db.refresh(gen)
            return gen

    async def update_by_id(
        self, generation_id: int, **fields: Any
    ) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            gen = result.scalar_one_or_none()
            if gen is None:
                return None
            for key, value in fields.items():
                setattr(gen, key, value)
            await db.commit()
            await db.refresh(gen)
            return gen

    async def toggle_like(self, generation_id: int) -> Generation | None:
        async with async_session_factory() as db:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            gen = result.scalar_one_or_none()
            if gen is None:
                return None
            gen.is_liked = 0 if gen.is_liked else 1
            await db.commit()
            await db.refresh(gen)
            return gen


generation_repository = GenerationRepository()
