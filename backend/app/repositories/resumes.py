"""In-memory resume repository.

WHY in-memory and not SQLAlchemy / SQLite right now?
    Phase 6b ships the API contract with the frontend. Adding SQLAlchemy +
    Alembic in the same change conflates "decide the API shape" with "decide
    the persistence stack" — each is a load-bearing decision that deserves
    its own PR. The repository interface defined here is the seam: when a
    SQL implementation arrives, routers and tests don't change.

WHY a class instead of module-level dicts?
    A class instance is a one-line dependency override in FastAPI. Tests
    swap in a fresh repository per test for full isolation; module-level
    state would leak between tests unless every test remembered to clear it.

WHY return Pydantic models from the repository?
    The router doesn't need to know the storage shape. Returning models
    keeps the "raw row" type private to this module — when SQL lands, the
    same Resume model still comes out the other side, regardless of whether
    it was hydrated from a row or pulled from a dict.

THREAD-SAFETY:
    Uvicorn's worker model: one event loop per process, async handlers run
    cooperatively. Our methods do no awaits between read and write, so we
    don't need a lock. If we ever introduce an `await` inside a mutation
    (e.g., calling an embedding service before save), the dict becomes a
    candidate for an asyncio.Lock — flagged here so future-you doesn't
    introduce the race silently.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.schemas.resume import Resume, ResumeCreate, ResumeUpdate, make_resume_id


def _utcnow_iso() -> str:
    """UTC timestamp, ISO-8601 with Z suffix and microsecond precision.

    Why microseconds and not seconds?
        Two POSTs within the same second is the realistic case (autosave,
        retries, tests). Without microsecond precision the list() sort by
        `updated_at` becomes unstable, and the frontend's "newest first"
        ordering would flip on rerender.

    Why a helper instead of inlining datetime.now(...).isoformat()?
        Single place to patch in tests for deterministic timestamps. Tests
        that need stable output (snapshot tests, etc.) monkeypatch this.
    """
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class ResumeNotFoundError(LookupError):
    """Raised when a lookup or update targets a missing id.

    Why a dedicated exception type instead of returning None?
        The router translates this to a 404 in one place. None-returning APIs
        force every caller to remember to check; an exception fails loudly
        if the check is forgotten.
    """

    def __init__(self, resume_id: UUID) -> None:
        super().__init__(f"resume {resume_id} not found")
        self.resume_id = resume_id


class ResumeRepository:
    """In-memory CRUD for Resume documents.

    Each instance is independent — tests use a fresh instance per test;
    production wires a singleton via the FastAPI dependency in `routers/`.
    """

    def __init__(self) -> None:
        self._items: dict[UUID, Resume] = {}

    def list(self) -> list[Resume]:
        """All resumes, newest first.

        Why newest first?
            The frontend's home/landing surfaces "your latest resume" in the
            first slot. Sorting here means every caller (UI, exports,
            future search) gets a sensible default without re-sorting.
        """
        return sorted(self._items.values(), key=lambda r: r.updated_at, reverse=True)

    def get(self, resume_id: UUID) -> Resume:
        try:
            return self._items[resume_id]
        except KeyError as exc:
            raise ResumeNotFoundError(resume_id) from exc

    def create(self, payload: ResumeCreate) -> Resume:
        now = _utcnow_iso()
        resume = Resume(
            id=make_resume_id(),
            title=payload.title,
            sections=payload.sections,
            created_at=now,
            updated_at=now,
        )
        self._items[resume.id] = resume
        return resume

    def update(self, resume_id: UUID, payload: ResumeUpdate) -> Resume:
        existing = self.get(resume_id)  # raises ResumeNotFoundError if missing
        updated = Resume(
            id=existing.id,
            title=payload.title,
            sections=payload.sections,
            created_at=existing.created_at,
            updated_at=_utcnow_iso(),
        )
        self._items[resume_id] = updated
        return updated

    def delete(self, resume_id: UUID) -> None:
        if resume_id not in self._items:
            raise ResumeNotFoundError(resume_id)
        del self._items[resume_id]
