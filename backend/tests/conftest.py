"""Shared pytest fixtures.

WHY conftest.py at the tests/ root and not inside each test file?
    Fixtures defined here are auto-discovered by pytest for every test in
    this directory and below — no per-file import needed. Keeps test files
    focused on what they're asserting, not on plumbing.

The fixtures here are intentionally minimal for Phase 6a:
    • `app`      → a fresh FastAPI instance per test (built via create_app).
    • `client`   → a TestClient bound to that app. TestClient is sync and
                   wraps httpx, so tests can use plain `client.get(...)`
                   regardless of whether the endpoint is async.

Phase 6b will add:
    • `db_session` for transaction-rolled-back DB access
    • `override_settings` to swap config per-test
"""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.resumes import ResumeRepository
from app.routers.resumes import get_resume_repository


@pytest.fixture
def repository() -> ResumeRepository:
    """Fresh in-memory repository per test. Returned separately from `app`
    so individual tests can seed it before invoking the client."""
    return ResumeRepository()


@pytest.fixture
def app(repository: ResumeRepository) -> FastAPI:
    """A fresh FastAPI app per test, with the in-memory repository wired
    via dependency override.

    Why override on the per-test app instead of mutating the production
    singleton? Two tests running in parallel (pytest-xdist) would clobber
    each other if they shared the singleton. Per-test override keeps the
    suite trivially parallelisable.
    """
    app = create_app()
    app.dependency_overrides[get_resume_repository] = lambda: repository
    return app


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    """TestClient bound to the per-test app. Yielding (not returning) lets
    TestClient run its own __enter__/__exit__ so startup/shutdown handlers
    fire correctly once we add them."""
    with TestClient(app) as client:
        yield client
