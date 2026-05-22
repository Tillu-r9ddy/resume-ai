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


@pytest.fixture
def app() -> FastAPI:
    """A fresh FastAPI app per test. Avoids state leaks between tests when
    we add dependency overrides — each test gets its own override dict."""
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    """TestClient bound to the per-test app. Yielding (not returning) lets
    TestClient run its own __enter__/__exit__ so startup/shutdown handlers
    fire correctly once we add them."""
    with TestClient(app) as client:
        yield client
