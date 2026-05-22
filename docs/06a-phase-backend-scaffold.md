# Phase 6a — Backend Scaffolding (FastAPI + pyproject.toml + ruff + pytest)

> Goal: stand up an empty backend that proves the toolchain works — install, run, lint, test, CI — without committing to a database, an auth model, or any business endpoints. Phase 6b lays the schema and the CRUD; this phase is the foundation it sits on.

## What we built and WHY

### 1. `backend/pyproject.toml` — single source of truth

One file replaces what older Python projects scatter across `setup.py`, `setup.cfg`, `requirements.txt`, `requirements-dev.txt`, `.flake8`, and `pytest.ini`. PEP 621 standardised the `[project]` table; every modern installer (pip, uv, hatch, poetry, pdm) reads it. Tool configs live under `[tool.<name>]` so anyone landing in the file sees ruff + pytest config alongside the dependencies that consume them.

Choices worth flagging:

- **`requires-python = ">=3.13"`.** Python 3.13 is the 2026 default (Oct 2024 release; 3.14 due Oct 2025). The features we'll lean on later — `PEP 695` type parameters, faster typing module, immortal objects — are all stable by 3.13. The matching `.python-version` file pins it for tools that respect it (`pyenv`, `uv`).
- **`hatchling` as build backend.** Lightweight, the default for `hatch`/`uv init`, no dynamic-version magic by default. We don't _need_ a build backend for the editable install, but pinning one now means later `pip install resume-ai-backend` (or building a Docker layer) works without rewiring.
- **Runtime deps kept to four.** `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`. Resist the urge to pre-add `sqlalchemy`, `alembic`, `httpx`, `redis` — each one is a supply-chain attack surface and a slower `pip install`. They land when the code that imports them does.
- **`[project.optional-dependencies].dev`** instead of a separate `requirements-dev.txt`. Same file, namespaced via the `[dev]` extra. `pip install -e ".[dev]"` mounts the project in editable mode and pulls the dev tools.

### 2. `app/main.py` — `create_app()` factory + `/api/health`

```python
def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="resume-ai backend", version="0.1.0")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, ...)

    @app.get("/api/health", tags=["meta"])
    async def health(settings: SettingsDep) -> dict[str, str]:
        return {"status": "ok", "version": app.version, "env": settings.env_name}

    return app


app = create_app()
```

Three intentional choices:

- **Factory pattern.** Tests build their own app instance with overridden dependencies. A module-level `app = FastAPI()` traps you the first time a test wants to swap a dependency: any code that already imported `app` sees the pre-override version. The factory makes per-test isolation a one-liner.
- **`/api` prefix on every route.** Reverse-proxy and CDN configs become trivial — "everything matching `/api/*` goes to the FastAPI origin." Without the prefix, you end up bolting on a path rewrite later or living with a flat namespace that collides with frontend static-asset paths.
- **`SettingsDep = Annotated[Settings, Depends(get_settings)]`.** FastAPI's idiomatic DI shape from 0.95+. Routes type-hint with `settings: SettingsDep` and tests override `get_settings` in `app.dependency_overrides`. Cleaner than passing a config object around explicitly.

### 3. `app/config.py` — typed env via `pydantic-settings`

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RESUME_AI_", extra="ignore")
    env_name: str = Field(default="local")
    cors_origins: list[str] = Field(default=["http://localhost:5173", ...])
```

Why bother with this for two fields?

- **Validation at boot.** Typo in an env var (`RESUEM_AI_CORS_ORIGINS`) raises a clear error instead of a mysterious 500 three requests in. With `extra="ignore"` unrelated env vars don't crash startup — important when `.env` files accumulate cruft from past experiments.
- **Type coercion.** `RESUME_AI_CORS_ORIGINS=http://a,http://b` is parsed into `list[str]` automatically. No string-splitting in business code.
- **One schema, discoverable.** Open `config.py`, see every knob. Beats `os.getenv("RESUME_AI_OBSCURE_FLAG")` hidden three modules deep.
- **`@lru_cache get_settings()`.** Re-parsing the env per request would be slow and would re-run validation. The cache pins the instance per process; tests can override the dependency without busting the cache.

### 4. `tests/conftest.py` — `app` + `client` fixtures

`conftest.py` lives at the tests root so pytest auto-discovers fixtures for every test file below. Two fixtures cover Phase 6a:

```python
@pytest.fixture
def app() -> FastAPI: return create_app()

@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as client:
        yield client
```

The `with TestClient(app)` form is load-bearing — it runs FastAPI's `lifespan` (startup/shutdown handlers) around the test, which we'll need the moment Phase 6b adds DB connection setup. Using `TestClient(app)` without the context manager skips those handlers entirely; a test that "passes" can hide a broken startup path.

### 5. `tests/test_health.py` — smoke + CORS-preflight regression

Two tests for one endpoint isn't over-testing — they cover different failure modes:

- **`test_health_returns_ok`** is the canary that proves the whole harness works. If TestClient can't mount the app and see this route, nothing downstream is testable. Worth pinning the response shape (`status`, `version`, `env`) because uptime monitors and the frontend's bootstrap probe depend on it.
- **`test_health_cors_preflight_allows_vite_origin`** catches a class of bug that's silent in unit tests: the CORS middleware is configured but rejects the Vite origin. The browser blocks the response before our code sees it, so the API "works" in a `curl` test but the frontend fetch fails. The preflight test catches a config-drift regression here at CI time, not in someone's devtools.

### 6. `ruff` — one tool replaces three

`ruff check + ruff format` replaces `flake8 + black + isort`. Written in Rust, ~100× faster than the Python equivalents on a large repo, so it stays usable on the pre-commit path. Rule families enabled:

| Family  | What it catches                                           |
| ------- | --------------------------------------------------------- |
| `E,W,F` | pyflakes + pycodestyle (the flake8 core)                  |
| `I`     | import sorting (replaces isort)                           |
| `B`     | likely-bugs (`bugbear`) — e.g., mutable default arguments |
| `UP`    | pyupgrade — modernise syntax for our `target-version`     |
| `N`     | PEP 8 naming                                              |
| `S`     | basic security checks (`bandit` subset)                   |
| `T20`   | catch stray `print()` statements                          |

Two narrow ignores:

- `S101` (assert) — pytest _needs_ assert. Allowed project-wide; tests would otherwise be a wall of `# noqa`.
- `S104` (bind 0.0.0.0) — fine in dev. We'll tighten this per-env in Phase 6b when we have a real deployment story.

### 7. CI — `.github/workflows/backend.yml`, path-filtered

Separate workflow from `ci.yml` (frontend) so they run in parallel and the GitHub Checks UI is readable ("Backend: pytest failed" vs "Frontend: lint failed"). Critically, both workflows are **path-filtered**: a frontend-only PR doesn't burn CI minutes booting Python. The pattern is:

```yaml
on:
  pull_request:
    paths:
      - 'backend/**'
      - '.github/workflows/backend.yml'
```

`cache: 'pip'` keyed on `backend/pyproject.toml` means PRs that don't change deps skip the slow PyPI download.

## Acceptance criteria

- ✅ `python -m venv .venv && pip install -e ".[dev]"` boots a clean install on Python 3.13.
- ✅ `uvicorn app.main:app --reload` serves `/api/health` → `{"status":"ok","version":"0.1.0","env":"local"}`.
- ✅ `pytest` finds and passes the 2 tests (smoke + CORS preflight).
- ✅ `ruff check .` + `ruff format --check .` are clean.
- ✅ FastAPI's auto Swagger UI works at `/docs`.
- ✅ Backend CI workflow runs only on `backend/**` or workflow file changes.
- ✅ Root README updated; per-phase status in the table flipped to 🟡 6a ✅.

## What we deliberately did NOT do

These belong to Phase 6b. Calling them out now so future commits don't accidentally smuggle them in:

- **SQLAlchemy / Alembic.** No DB until we have a model worth persisting. The day we add `sqlalchemy` to deps is the day we set up Alembic in the same PR — never `sqlalchemy` without migrations.
- **Auth (JWT, OAuth, sessions).** Phase 6b decision. Adding it before there's anything to protect just produces dead code.
- **A `Resume` Pydantic model.** Mirroring the Zod schema in `frontend/src/schema/resume.ts` is the _first_ thing Phase 6b does, alongside the CRUD endpoints that use it. The schema is a contract; we want one PR that lands both sides.
- **Docker / docker-compose.** Local dev with venv is enough for now. Compose lands when Postgres does (so the same `docker compose up` boots the app + its DB).
- **Logging / OpenTelemetry / structured logs.** Default uvicorn logging is fine while there's no real traffic to slice. Observability is a Phase 9 concern.
- **Async DB drivers, connection pools, background task workers.** Premature without a workload that needs them.

## Interview questions Phase 6a prepares you to answer

> **Q:** Why `pyproject.toml` over `requirements.txt`?
> **A:** PEP 621 standardised project metadata in one file; modern installers (uv, pip, hatch, poetry, pdm) all read it. You get project metadata, runtime deps, dev deps (via optional-dependencies extras), and tool config (ruff, pytest, mypy) in one place instead of scattered across setup.py + setup.cfg + requirements files + .flake8 + pytest.ini. The build-system table makes the project installable as a wheel later without rewiring. For a brand-new 2026 Python project, requirements.txt is a legacy choice.

> **Q:** Why a `create_app()` factory instead of `app = FastAPI()` at module scope?
> **A:** Tests need to mount their own app with overridden dependencies. A module-level singleton is set in stone the moment anything imports it, so per-test isolation requires monkey-patching. The factory makes it `app = create_app()` in a fixture and you swap dependencies via `app.dependency_overrides` cleanly. The cost is one extra function for one extra commit; the benefit is the entire test suite stays composable as the app grows.

> **Q:** Why `pydantic-settings` over `os.environ` directly?
> **A:** Three things. Type validation at boot — typos and bad values fail fast with a clear error instead of producing mysterious runtime bugs deep in a handler. Type coercion — comma-separated env vars parse into `list[str]` automatically, paths into `Path`, ints into `int`. And discoverability — open one file (config.py) and see every knob the service respects, instead of grep-ing for `os.getenv` across the codebase. The cost is one extra dep; the benefit scales linearly with team size and config surface.

> **Q:** Why `ruff` over `flake8 + black + isort`?
> **A:** One tool replaces three, ~100× faster (it's written in Rust), and the rule coverage is a superset. The single config block in pyproject.toml is easier to maintain than three configs that subtly disagree. Pre-commit hooks stay fast enough that no one disables them. The trade-off is a slightly smaller plugin ecosystem than flake8's, but ruff has reimplemented the popular plugins (bugbear, pyupgrade, bandit, pep8-naming) as built-in rule families.

> **Q:** Why prefix every API route with `/api`?
> **A:** Reverse-proxy and CDN routing becomes one line: everything matching `/api/*` goes to the backend; everything else is a static frontend asset. Without the prefix, you end up with flat-namespace collisions (frontend route `/users` vs backend `/users`) or you bolt on a path rewrite later, which is harder to reason about during incidents. Cost is zero; benefit is one fewer deployment-time surprise.

> **Q:** Why path-filter CI workflows?
> **A:** A doc-only PR shouldn't burn CI minutes booting Python and pip-installing FastAPI; a frontend-only PR shouldn't run pytest. Path filters keep the feedback loop tight and the GitHub Actions billing reasonable. The risk — a backend file that _should_ trigger backend CI gets filtered out — is mitigated by listing both `backend/**` and `.github/workflows/backend.yml` (so changes to the workflow itself always run). For a monorepo this is the cheapest single configuration win.

> **Q:** Why install pytest-asyncio when our one route is `async def` but our test client is sync?
> **A:** Forward investment. FastAPI's `TestClient` is sync (it wraps httpx) and works fine against async endpoints today — the framework runs them on an event loop internally. But the moment we add a test that needs to talk to async code directly (querying an async SQLAlchemy session, mocking an async upstream), we'll want native `async def test_...` support. Installing pytest-asyncio + setting `asyncio_mode = "auto"` now means that test is a one-line addition, not a config-change-plus-deps-change PR.

## What's next: Phase 6b — the resume schema + CRUD

- Mirror `frontend/src/schema/resume.ts` as a Pydantic model in `app/schemas/resume.py`. Same shape, both sides validate independently.
- Add SQLAlchemy 2.0 (async) + Alembic, with the first migration creating the `resume` table.
- `/api/resumes` CRUD: list, get, create, update (full replace), delete.
- Replace the frontend's localStorage-only persistence with a save-on-blur call to the API; `AutosaveIndicator` wires to real network status (`saving` while inflight, `saved · timestamp` on success, `offline · N pending` on failure).
- Tests use a transaction-rolled-back DB session per test so each test sees a clean state.

Auth is _not_ in 6b — that's 6c. Single-user mode + a hard-coded user id until then.
