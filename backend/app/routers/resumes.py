"""/api/resumes — CRUD over Resume documents.

WHY a router module instead of routes inside main.py?
    Once there's more than one resource, putting them all in main.py turns
    that file into a junk drawer. Per-resource modules keep ownership clear
    and let tests target one router at a time.

WHY APIRouter with a `prefix="/api/resumes"` instead of full paths?
    DRYs the prefix into one place. If we ever version the API
    (`/api/v2/resumes`) it's a one-line change here.

WHY a dependency for `get_resume_repository()` instead of a module global?
    Test isolation. Each test overrides this dependency with a fresh
    ResumeRepository(), which is impossible if the router imports a singleton
    at module load time.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.repositories.resumes import ResumeNotFoundError, ResumeRepository
from app.schemas.resume import Resume, ResumeCreate, ResumeUpdate

# Process-wide singleton. Replaced via `app.dependency_overrides` in tests.
# In production this is the only state the in-memory implementation keeps;
# when SQL lands, this becomes a session-factory dependency instead.
_default_repository = ResumeRepository()


def get_resume_repository() -> ResumeRepository:
    """FastAPI dependency. Returns the process-wide repository singleton."""
    return _default_repository


RepoDep = Annotated[ResumeRepository, Depends(get_resume_repository)]


router = APIRouter(prefix="/api/resumes", tags=["resumes"])


@router.get("", response_model=list[Resume])
async def list_resumes(repo: RepoDep) -> list[Resume]:
    """List all resumes, newest first.

    No pagination yet — single-user mode caps the realistic count at "a
    handful". When multi-user lands (Phase 6c+), this gets `limit`/`cursor`.
    """
    return repo.list()


@router.post("", response_model=Resume, status_code=status.HTTP_201_CREATED)
async def create_resume(payload: ResumeCreate, repo: RepoDep) -> Resume:
    return repo.create(payload)


@router.get("/{resume_id}", response_model=Resume)
async def get_resume(resume_id: UUID, repo: RepoDep) -> Resume:
    try:
        return repo.get(resume_id)
    except ResumeNotFoundError as exc:
        # 404 with the id echoed back — helps the frontend differentiate
        # "wrong id" from "auth/network failure" in the same error handler.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"resume {exc.resume_id} not found",
        ) from exc


@router.put("/{resume_id}", response_model=Resume)
async def replace_resume(resume_id: UUID, payload: ResumeUpdate, repo: RepoDep) -> Resume:
    """Full replacement of the resume body.

    Why PUT (full replace) not PATCH (partial)?
        See ResumeUpdate's docstring — small doc + debounced autosave makes
        PATCH's complexity not worth the bytes saved.
    """
    try:
        return repo.update(resume_id, payload)
    except ResumeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"resume {exc.resume_id} not found",
        ) from exc


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(resume_id: UUID, repo: RepoDep) -> Response:
    try:
        repo.delete(resume_id)
    except ResumeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"resume {exc.resume_id} not found",
        ) from exc
    # 204 means "success, no body". FastAPI's default response model would
    # try to encode None into JSON, which a strict HTTP client treats as
    # invalid for a 204. Explicit Response() with no content is the fix.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
