"""Runtime configuration, driven by environment variables.

WHY pydantic-settings instead of os.environ directly?
    A typed BaseSettings subclass gives us:
      • Validation on startup — typos like `CROS_ORIGINS` (instead of
        `CORS_ORIGINS`) raise a clear error at boot, not a mysterious 500.
      • Type coercion — `BACKEND_CORS_ORIGINS=http://a,http://b` parses into
        a list[str] automatically; ints/bools/paths Just Work.
      • One discoverable schema. Open this file, see every knob the service
        respects. No `os.getenv("OBSCURE_FLAG")` hidden in some module.
      • .env file loading for dev, with environment-variable overrides for
        production — same code path either way.

WHY a single Settings() singleton via @lru_cache?
    FastAPI dependencies that depend on settings should always get the same
    instance per process. Re-parsing the env on every request would be slow
    and would re-trigger validation. The cache pins it after first read.

This is a Phase 6a minimum — we'll grow it to include DB URL, JWT secret,
and Ollama host in Phase 6b. Keeping it small for now so each addition is a
deliberate, reviewable change.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service-wide configuration. All env vars are prefixed with RESUME_AI_."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="RESUME_AI_",
        # Unknown env vars are silently ignored. Without this, an unrelated env
        # var like `RESUME_AI_DEBUG_LEGACY` would crash startup — fine for prod
        # but punishing during dev when env files accumulate cruft.
        extra="ignore",
    )

    # Human-friendly name shown in the /api/health payload and (later) logs.
    # Defaults to "local" so a brand-new clone with no .env still boots.
    env_name: str = Field(default="local", description="Deployment environment name")

    # CORS allow-list. Comma-separated string from the env, split into a list
    # by pydantic's automatic parsing. Defaults to the Vite dev server origin
    # so a brand-new clone can talk to /api without any env wiring.
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Origins allowed to call the API",
    )


@lru_cache
def get_settings() -> Settings:
    """Return the singleton Settings instance.

    Use as a FastAPI dependency: `settings: Settings = Depends(get_settings)`.
    Tests can override this via app.dependency_overrides for per-test config.
    """
    return Settings()
