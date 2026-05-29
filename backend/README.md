# resume-ai backend

FastAPI service for resume-ai — resume CRUD + streaming chat with a pluggable
LLM provider.

## What it does

| Route               | Method | Purpose                                              |
| ------------------- | ------ | ---------------------------------------------------- |
| `/api/health`       | GET    | Liveness probe (used by docker-compose + uptime)     |
| `/api/resumes`      | GET    | List resumes (newest first)                          |
| `/api/resumes`      | POST   | Create a resume — returns server-assigned id + ts    |
| `/api/resumes/{id}` | GET    | Fetch one                                            |
| `/api/resumes/{id}` | PUT    | Full-replace update                                  |
| `/api/resumes/{id}` | DELETE | Remove (204 No Content)                              |
| `/api/chat`         | POST   | Stream chat tokens back as SSE (`text/event-stream`) |

Storage is **in-memory** today (see Phase 9 doc for the SQL plan). The
`ResumeRepository` abstraction is the seam where Postgres/SQLAlchemy slots
in without changing routers, tests, or the frontend.

## Setup

```powershell
# from backend/
python -m venv .venv
.\.venv\Scripts\Activate.ps1       # PowerShell
# or:  .venv\Scripts\activate.bat   (cmd)
# or:  source .venv/bin/activate    (bash/zsh)

pip install -e ".[dev]"
```

## Run

```powershell
# from backend/, venv active
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/api/health
# → http://localhost:8000/docs   (FastAPI's auto-generated Swagger UI)
```

## Test + lint

```powershell
pytest
ruff check .
ruff format --check .       # add --fix / drop --check to write
```

Test count by file:

- `tests/test_health.py` — 2 (smoke + CORS preflight)
- `tests/test_resumes.py` — 10 (CRUD + ordering + 404 + 422)
- `tests/test_chat.py` — 4 (SSE frames + validation + headers)
- `tests/test_resume_schema.py` — 5 (Pydantic model unit tests)

## Configuration

All env vars are prefixed with `RESUME_AI_`. Defaults work out of the box for
local development; create a `.env` in `backend/` (copy from `.env.example`)
to override.

| Var                      | Default                                             | Purpose                                         |
| ------------------------ | --------------------------------------------------- | ----------------------------------------------- |
| `RESUME_AI_ENV_NAME`     | `local`                                             | Shown in `/api/health` for "which env am I on?" |
| `RESUME_AI_CORS_ORIGINS` | `["http://localhost:5173","http://127.0.0.1:5173"]` | JSON list of allowed CORS origins               |
| `RESUME_AI_LLM_PROVIDER` | `echo`                                              | `"echo"` (no install) or `"ollama"` (real LLM)  |
| `RESUME_AI_OLLAMA_HOST`  | `http://localhost:11434`                            | Used only when provider=ollama                  |
| `RESUME_AI_OLLAMA_MODEL` | `llama3.1:8b`                                       | Model tag (must already be `ollama pull`-ed)    |

See `app/config.py` for the full schema.

### Switching to the real LLM

1. Install [Ollama](https://ollama.com).
2. `ollama pull llama3.1:8b` (or whatever model tag you set).
3. `RESUME_AI_LLM_PROVIDER=ollama uvicorn app.main:app --reload`

The provider abstraction (`app/services/llm.py`) means no code changes are
needed to swap. Add new providers by subclassing `ChatProvider` and
extending `make_provider()`.

## Docker

```bash
# from repo root
docker compose up backend --build
# → http://localhost:8000/api/health
```

The image is multi-stage (builder venv → slim runtime), runs as a non-root
user, and exposes a healthcheck on `/api/health`. See `backend/Dockerfile`
for the details.

## Layout

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                ← create_app() factory + /api/health + CORS
│   ├── config.py              ← pydantic-settings env config
│   ├── schemas/
│   │   └── resume.py          ← Pydantic mirror of frontend Zod (Phase 6b)
│   ├── repositories/
│   │   └── resumes.py         ← In-memory CRUD + ResumeNotFoundError
│   ├── routers/
│   │   ├── resumes.py         ← /api/resumes endpoints
│   │   └── chat.py            ← /api/chat SSE endpoint
│   └── services/
│       └── llm.py             ← ChatProvider ABC + Echo/Ollama impls
├── tests/
│   ├── conftest.py            ← app/client/repository fixtures + DI overrides
│   ├── test_health.py
│   ├── test_resumes.py
│   ├── test_chat.py
│   └── test_resume_schema.py
├── Dockerfile                 ← multi-stage, non-root user
├── .dockerignore
├── .env.example
├── pyproject.toml             ← deps + ruff + pytest config
└── .python-version            ← 3.13
```
