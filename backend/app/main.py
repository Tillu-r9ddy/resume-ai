"""FastAPI application factory + /api/health.

WHY a `create_app()` factory and not a module-level `app = FastAPI()`?
    Tests mount their own app instance with overridden dependencies. A
    factory makes that one line (`app = create_app()` in a fixture) and
    avoids the singleton-during-import trap where importing this module
    eagerly initialises database pools, opens telemetry connections, etc.

    For Phase 6a the factory is overkill — there's no DB pool yet. We pay
    the small abstraction cost now so Phase 6b can add startup wiring
    without rewriting every test.

WHY a single /api prefix on every route?
    Reverse proxies (nginx, Cloudflare, FastAPI behind a CDN) route by path
    prefix. Putting every endpoint under /api means the frontend's static
    asset routes never collide with backend routes, and the CDN config is
    one line: "everything matching /api/* goes to the FastAPI origin."

WHY /api/health and not /health or /healthz?
    /api/health for the same prefix-routing reason. We're not a Kubernetes
    workload yet so /healthz (k8s convention) would be premature. When we
    add a liveness probe in Phase 9, we can add /healthz as a thin alias.
"""

from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.routers import chat as chat_router
from app.routers import resumes as resumes_router

# Annotated[Settings, Depends(get_settings)] is FastAPI's idiomatic dependency
# injection shape. Routes that need settings just type-hint with this alias;
# tests override get_settings via app.dependency_overrides for per-test config.
SettingsDep = Annotated[Settings, Depends(get_settings)]


def create_app() -> FastAPI:
    """Build a configured FastAPI application instance."""

    settings = get_settings()

    app = FastAPI(
        title="resume-ai backend",
        version="0.2.0",
        description="Phase 6b — resume CRUD + streaming chat (pluggable provider).",
    )

    # CORS — the frontend lives on a different origin in dev (Vite 5173) and
    # potentially in prod (Cloudflare Pages → API origin). Restrict to the
    # explicit allow-list rather than "*", which would block credentialed
    # requests anyway.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/api/health", tags=["meta"])
    async def health(settings: SettingsDep) -> dict[str, str]:
        """Liveness probe.

        Returns the version and env name so a developer can confirm at a
        glance which deployment they're hitting. Intentionally cheap — no DB
        roundtrip, no auth — so it can be hammered by load balancers and
        uptime monitors without disturbing the app.
        """
        return {
            "status": "ok",
            "version": app.version,
            "env": settings.env_name,
        }

    # Mount feature routers. Order is irrelevant for matching (FastAPI picks
    # by path prefix) but kept resource-then-meta for readability.
    app.include_router(resumes_router.router)
    app.include_router(chat_router.router)

    return app


# Module-level app for `uvicorn app.main:app` to find. The factory above is
# what tests should use; this binding is the production entrypoint.
app = create_app()
