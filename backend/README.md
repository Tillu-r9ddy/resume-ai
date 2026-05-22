# resume-ai backend

FastAPI service for resume-ai. **Phase 6a scaffolding** — only `/api/health` for now.
CRUD endpoints land in Phase 6b.

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

## Configuration

All env vars are prefixed with `RESUME_AI_`. Defaults work out of the box for
local development; create a `.env` in `backend/` to override.

| Var                      | Default                                       | Used for         |
| ------------------------ | --------------------------------------------- | ---------------- |
| `RESUME_AI_ENV_NAME`     | `local`                                       | Shown in /health |
| `RESUME_AI_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allow-list  |

See `app/config.py` for the full schema.

## Layout

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py        ← FastAPI factory + routes
│   └── config.py      ← pydantic-settings env config
├── tests/
│   ├── conftest.py    ← shared fixtures (app, client)
│   └── test_health.py
├── pyproject.toml     ← deps + ruff + pytest config
└── .python-version    ← 3.13
```
