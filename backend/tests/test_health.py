"""Smoke test for /api/health.

WHY a test for a single-line endpoint?
    Two reasons. First, it's the canary that proves the whole test harness
    works — TestClient mounts the app, sees the route, returns JSON. If
    this test breaks, every other backend test is dead in the water.
    Second, /api/health is the contract uptime monitors and the frontend's
    bootstrap probe depend on; the shape ({status, version, env}) is part
    of that contract and worth pinning.
"""

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    # We don't pin the exact version string — that would force a test edit on
    # every bump. We just confirm the shape.
    assert isinstance(body["version"], str)
    assert isinstance(body["env"], str)


def test_health_cors_preflight_allows_vite_origin(client: TestClient) -> None:
    """The frontend's bootstrap fetch is cross-origin in dev; if the CORS
    config drifts, the browser blocks the response before our code sees it.
    A preflight check here catches that regression at test time."""
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in (200, 204)
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
