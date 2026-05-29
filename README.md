# Resume-AI

> An open-source, AI-friendly resume builder — like Overleaf, but you don't need to know LaTeX. Chat with an AI assistant to draft, edit, and tailor ATS-friendly resumes.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi)](https://fastapi.tiangolo.com)

## Why this project exists

This repo is a **learning-first, ship-second** portfolio project. The goal: master every layer of modern React (from `useState` to React 19 concurrent features, from Context to Redux Toolkit, from CSR to streaming SSE) by building one real product end-to-end.

Every config file, every component, every commit message is annotated with a **WHY** comment so the repo doubles as a teaching artifact.

## What you'll find here (by phase)

| Phase | Topic                                                                               | Status                                                          |
| ----- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | Foundation — Vite + TS + tooling + parallel webpack lesson                          | ✅                                                              |
| 2     | React Router, code splitting, Suspense, error boundaries, Tailwind v4 + Shell       | ✅                                                              |
| 3     | State management tour (Zustand · RTK · TanStack Query · Jotai · Context done right) | 🟡 3a Zustand ✅ · 3b RTK ✅ (in 4a)                            |
| 4     | Forms with React Hook Form + Zod, field arrays, controlled vs uncontrolled          | ✅ 4a store · 4b header · 4c sections · 4d reorder              |
| 5     | Performance — memo, virtualization, Web Workers, bundle analysis                    | ✅                                                              |
| 6     | FastAPI backend, SSE streaming, pluggable LLM provider                              | ✅ 6a scaffold · 6b CRUD · 6c streaming chat · 6d frontend wire |
| 7     | Concurrent React + PDF export (browser-native, no PDF library)                      | ✅                                                              |
| 8     | Testing — Vitest + RTL + MSW (smoke coverage)                                       | ✅                                                              |
| 9     | CI/CD — GitHub Actions, multi-stage Dockerfiles, docker-compose                     | ✅                                                              |

Per-phase deep dives live in [`docs/`](./docs/).

## Tech stack (locked-in decisions)

| Layer   | Choice                                                                                     | Why                                             |
| ------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Bundler | **Vite** (primary) + commented `webpack.config.js`                                         | Vite for DX; Webpack file for interview prep    |
| UI      | **React 19 + TypeScript 6**                                                                | 2026 standard; React Compiler, Actions, `use()` |
| Routing | React Router v7 (Phase 2)                                                                  | de-facto SPA router                             |
| State   | **Zustand** · **RTK + RTK Query** · **TanStack Query** · **Jotai** · Context (selectively) | each chosen to teach a _different_ problem      |
| Forms   | **React Hook Form + Zod**                                                                  | uncontrolled-first, schema-validated            |
| Styling | **TailwindCSS** (Phase 2)                                                                  | utility-first, fast to iterate                  |
| Backend | **FastAPI + Python 3.13**                                                                  | matches user's existing AI stack                |
| LLM     | **Ollama + Llama 3.1 8B** (local, OSS)                                                     | zero API cost, abstracted provider interface    |
| Testing | **Vitest + RTL + Playwright + Storybook + MSW**                                            | unit → integration → E2E coverage               |
| CI/CD   | **GitHub Actions + Docker Compose**                                                        | open-source standard                            |
| Deploy  | Cloudflare Pages (frontend) + self-hosted VPS (backend)                                    | fully open-source path                          |

## Repo layout

```
resume-ai/
├── frontend/                  ← Vite + React + TypeScript app
│   ├── src/
│   │   ├── api/                  (fetch wrapper + streamChat SSE consumer — Phase 6d)
│   │   ├── components/           (Shell, ThemeManager, editor/, preview/, dev/)
│   │   ├── hooks/                (useBackendAutosave — Phase 6d)
│   │   ├── routes/               (Home, Editor, Chat, Print, NotFound — lazy chunks)
│   │   ├── schema/               (Zod schemas — resume document is the contract)
│   │   ├── store/                (RTK store + slices, wrapped by redux-undo + redux-persist)
│   │   ├── stores/               (Zustand stores — UI state like sidebar + theme)
│   │   ├── test/                 (Vitest setup + MSW handlers — Phase 8)
│   │   ├── router.tsx            (createBrowserRouter — v7 data router)
│   │   ├── App.tsx               (mounts <RouterProvider /> + <ThemeManager />)
│   │   └── index.css             (Tailwind v4 + @theme tokens + light theme + @media print)
│   ├── vite.config.ts            (build + Vitest config — react + tailwindcss + jsdom)
│   ├── webpack.config.js         (LEARNING-ONLY, not used to build)
│   ├── nginx.conf                (prod nginx — SPA fallback + /api proxy + SSE-friendly)
│   ├── Dockerfile                (multi-stage Node → nginx)
│   ├── eslint.config.js
│   └── README.md
├── backend/                    ← FastAPI service (Phase 6)
│   ├── app/
│   │   ├── main.py               (create_app() factory + CORS + router mount)
│   │   ├── config.py             (pydantic-settings — env-driven config)
│   │   ├── schemas/resume.py     (Pydantic mirror of frontend Zod — Phase 6b)
│   │   ├── repositories/         (in-memory ResumeRepository — Phase 6b)
│   │   ├── routers/              (resumes CRUD + chat SSE — Phase 6b/6c)
│   │   └── services/llm.py       (ChatProvider ABC + Echo/Ollama impls — Phase 6c)
│   ├── tests/                    (pytest — 21 tests across CRUD + chat + schema + health)
│   ├── pyproject.toml            (deps + ruff + pytest config)
│   ├── Dockerfile                (multi-stage Python, non-root user)
│   └── README.md
├── docs/                       ← Per-phase deep dives + decision records (01..09)
├── docker-compose.yml          ← Local prod-shaped stack (+ opt-in Ollama profile)
├── .github/workflows/          ← ci.yml (frontend) · backend.yml · docker.yml
├── package.json                ← Workspace root, runs husky + commitlint
├── commitlint.config.js
├── .prettierrc.json
├── .editorconfig
└── .gitignore
```

## Getting started

### Prerequisites

- **Node.js ≥ 20** (LTS) — `node --version`
- **npm ≥ 10** — comes with Node
- **Git** — for hooks to install
- (Phase 6+) **Python ≥ 3.11** and **Ollama** — install Ollama from [ollama.com](https://ollama.com)

### First-time setup

```bash
# Install all workspaces (frontend deps + root husky/prettier/commitlint)
npm install

# That triggers `husky` which wires the pre-commit and commit-msg hooks.

# Start the frontend dev server
npm run dev
# → http://localhost:5173
```

#### Backend (Phase 6a — scaffolding only)

```powershell
# from backend/
python -m venv .venv
.\.venv\Scripts\Activate.ps1       # PowerShell
# or:  source .venv/bin/activate    (bash/zsh)

pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/api/health
# → http://localhost:8000/docs    (Swagger UI)
```

See [`backend/README.md`](./backend/README.md) for details.

### Common scripts

| Command                             | What it does                                 |
| ----------------------------------- | -------------------------------------------- |
| `npm run dev`                       | Vite dev server for `frontend/`              |
| `npm run build`                     | Production build → `frontend/dist/`          |
| `npm run preview`                   | Serve the built dist locally                 |
| `npm run lint`                      | ESLint across workspaces                     |
| `npm run lint:fix`                  | ESLint with auto-fix                         |
| `npm run typecheck`                 | TS type-check without emitting               |
| `npm test -w frontend`              | Vitest run (one-shot, CI-style)              |
| `npm run test:watch -w frontend`    | Vitest watch mode                            |
| `npm run test:coverage -w frontend` | Vitest with v8 coverage report → `coverage/` |
| `npm run format`                    | Prettier write everything                    |
| `npm run format:check`              | Prettier check (CI-friendly)                 |

### Running the full stack (Docker)

For a prod-shaped local stack (nginx → FastAPI behind one origin):

```bash
docker compose up --build
# → http://localhost:8080      (SPA, /api proxied to backend)
# → http://localhost:8000/api/health   (backend, exposed for convenience)
```

Opt in to the local Ollama model (~4 GB download):

```bash
docker compose --profile ollama up --build
```

Tear down and drop the Ollama volume:

```bash
docker compose down -v
```

### Commit conventions

Commits MUST follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

feat(chat): add streaming SSE response to AI assistant
fix(auth): handle expired JWT on refresh
docs(readme): document Phase 3 state management decisions
chore(deps): bump react to 19.2.7
```

Husky + commitlint reject non-conforming messages at commit time.

## Author

[Tilak Kumar Vasa](https://github.com/Tillu-r9ddy) — building this during a job search to deeply re-master React.

## License

MIT — see [LICENSE](./LICENSE).
