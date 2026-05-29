# Phase 9 — CI/CD: Multi-stage Dockerfiles + docker-compose + Workflows

> Goal: ship the project as a deployable stack and a CI pipeline that catches regressions in both the code and the deployment artefacts. Three Dockerfiles, one compose file, three GitHub workflows — each one of these is the smallest thing that solves a specific failure mode.

## What we built and WHY

### 1. `backend/Dockerfile` — multi-stage Python

```dockerfile
FROM python:3.13-slim AS builder
RUN python -m venv /opt/venv && /opt/venv/bin/pip install .

FROM python:3.13-slim AS runtime
COPY --from=builder /opt/venv /opt/venv
USER app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- **Multi-stage** — builder installs the wheel into a venv; runtime copies the venv and only the venv. Final image is ~120 MB instead of ~400 MB. Pulls faster, scans cleaner, has fewer CVEs.
- **`python:3.13-slim`, not `-alpine`** — alpine ships musl libc; most Python wheels are glibc. Pip falls back to compiling from source, which both fails on many packages and bloats the "small" image with a C toolchain. Debian-slim is the actual sweet spot.
- **Non-root user** — default Docker runs as root, which means a container escape lands as root on the host. `USER app` keeps a compromised process scoped.
- **Healthcheck** — `urllib.request` against `/api/health`. docker-compose, k8s, and PaaS providers all read it.
- **`uvicorn` directly, no gunicorn** — workload is async-heavy (SSE streams). gunicorn's sync workers don't help; horizontal scaling is the orchestrator's job, not the container's.

### 2. `frontend/Dockerfile` — Node builds, nginx serves

```dockerfile
FROM node:22-alpine AS builder
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci --workspaces --include-workspace-root
COPY frontend ./frontend
RUN npm run build -w frontend

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/frontend/dist /usr/share/nginx/html
```

- **nginx, not `vite preview`** — vite preview is a Node process (~80 MB RAM idle); nginx is C and ~5 MB. For shipping a `dist/`, nginx is the canonical choice.
- **Build context is the repo root** — the frontend is an npm workspace, so the lockfile + root `package.json` are required for `npm ci` to resolve correctly. The Dockerfile path is `frontend/Dockerfile` relative to the root context.
- **Layer cache pattern** — copy `package.json` + lockfile first, run `npm ci`, then copy source last. Source changes don't bust the install layer; the rebuild takes seconds.
- **`alpine` here is fine** — Node has prebuilt binaries for musl, and there's no native-extension surprise the way there is in Python.

### 3. `frontend/nginx.conf` — SPA + API proxy

```nginx
location ~* \.(js|css|woff2?|...)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
location /api/ {
  proxy_pass http://backend:8000;
  proxy_buffering off;            # SSE — flush as it arrives
  proxy_read_timeout 1h;          # long generations
}
location / {
  try_files $uri $uri/ /index.html;   # SPA-router fallback
}
```

Three rules, one for each routing case:

- **Hashed assets** — long cache + `immutable`. Vite's content hashes in filenames mean the URL changes whenever the bytes change, so caching forever is safe.
- **`/api/*`** — proxy_pass to the `backend` service. `proxy_buffering off` is the SSE-must-have (nginx default would batch tokens until buffer fills). `proxy_read_timeout 1h` covers long LLM generations.
- **SPA fallback** — `try_files $uri ... /index.html` makes `/editor` reload work (without it, refreshing a client-side route 404s).

### 4. `docker-compose.yml` — one stack, two services, one opt-in profile

```yaml
services:
  backend: { build: ./backend, ports: ['8000:8000'], healthcheck: ... }
  frontend:
    build: { context: ., dockerfile: frontend/Dockerfile }
    depends_on:
      backend: { condition: service_healthy }
  ollama: { image: ollama/ollama:latest, profiles: ['ollama'] }
```

- **No `version:` key** — Compose v2 (the default since Docker Desktop 2022+) treats it as deprecated.
- **`depends_on.condition: service_healthy`** — frontend boots only when backend's healthcheck passes. Without this, nginx tries to proxy `/api` before the backend is ready and the first 30 seconds of requests 502.
- **Ollama behind `profiles: ['ollama']`** — opt-in. The image is ~1 GB and pulling Llama 3.1 8B is another 4 GB. 99% of contributors just want the echo provider for a working demo. `docker compose --profile ollama up` for the people who want it.
- **Named volume `ollama-data`** — model weights survive `docker compose down`. `docker compose down -v` drops them when you want a clean slate.

### 5. CI workflows — three of them, path-filtered

`.github/workflows/ci.yml` (frontend):

- Lint, format check, typecheck, **test** (new in Phase 9), build.
- Node 22 pinned (not "lts" — pinning avoids surprise major upgrades).

`.github/workflows/backend.yml` (Python — unchanged, already from Phase 6a):

- Path-filtered on `backend/**`.
- Ruff lint + format check, pytest, pip cache keyed on pyproject.toml.

`.github/workflows/docker.yml` (new in Phase 9):

- Path-filtered on `Dockerfile`, `nginx.conf`, `docker-compose.yml` and the workflow file itself.
- `docker compose build --pull` proves the Dockerfiles still build clean.
- Boots the backend service and polls `/api/health` for 60 s. Dumps logs on failure.
- Doesn't push images — we don't have a registry account yet, and the goal here is regression detection, not artifact production.

Why three workflows instead of one? **Failure isolation + parallelism.** A backend-only PR doesn't need to wait on the frontend test job, and vice versa. The Checks UI surfaces "Backend: pytest failed" vs "Frontend: lint failed" as separate signals. Path filters mean a doc-only PR runs neither.

### 6. `.env.example` files

Two of them — `backend/.env.example` and `frontend/.env.example`. Both committed so contributors see the full surface of env vars without grepping. Both call out the **defaults that work out of the box** so a fresh clone is `npm install + uvicorn` without any `.env` file at all.

## Acceptance criteria

- ✅ `docker compose build` succeeds locally on a clean checkout.
- ✅ `docker compose up` boots both services; `curl http://localhost:8080/` returns the SPA and `curl http://localhost:8000/api/health` returns `{"status":"ok"}`.
- ✅ Frontend → backend `/api/resumes` round-trips through the nginx proxy.
- ✅ Backend container runs as the non-root `app` user.
- ✅ Final backend image is < 200 MB; frontend image is < 60 MB.
- ✅ CI workflows run only when their respective paths change.
- ✅ `docker.yml` workflow passes — proves the stack still boots.

## What we deliberately did NOT do

- **Push to a registry.** Need credentials, need a registry, need a deploy target. The repo isn't deployed anywhere yet — `build` without `push` catches the regression we care about (Dockerfile drift) without the operational overhead.
- **Kubernetes manifests.** Premature. docker-compose covers single-host deployment, which is the right shape for a portfolio project. Manifests when there's a real cluster.
- **TLS / certbot.** Behind a real load balancer (Cloudflare, Fly.io, Render) this is handled at the platform layer. Bolting it into nginx makes the dev compose stack heavier without buying anything.
- **Build matrix (multi-Python, multi-Node).** We pin one version. Multi-version CI is for libraries that ship to other people's stacks — our backend is the app, not a library.
- **`docker compose push`-and-deploy automation.** Same as the registry — no target yet. The day there is one, it's one workflow file away.
- **Per-environment compose overrides.** YAGNI. One compose file is the prod shape; dev runs from `npm run dev` + `uvicorn --reload`, which is faster than rebuilding containers on save.

## Interview questions Phase 9 prepares you to answer

> **Q:** Why multi-stage Docker builds?
> **A:** The build environment (compilers, pip caches, node_modules) is much larger than the runtime needs. Multi-stage lets the final image contain only the runtime artefacts — for Python that's a venv with installed packages; for the frontend that's nginx + a built dist directory. Image size drops 3-4×, which means faster pulls, smaller attack surface, and cheaper storage. The cost is one extra FROM line; the benefit is structural.

> **Q:** Why python-slim instead of alpine for the backend?
> **A:** alpine ships musl libc; the vast majority of Python wheels are built for glibc. Without glibc, pip falls back to building from source, which fails on packages with C extensions and bloats the supposedly-small image with a build toolchain. Debian-slim is the actual minimum — glibc, modern Python, no docs, no compilers. The "alpine is smaller" claim is only true for Python projects with zero compiled deps, which is rare.

> **Q:** Why disable nginx buffering for /api?
> **A:** Server-Sent Events. nginx buffers responses by default — it waits to flush until the buffer is full or the upstream closes. For an SSE stream, that batches all your tokens into one chunk at the end and the UI looks frozen. `proxy_buffering off` makes nginx forward bytes as they arrive. The `proxy_read_timeout 1h` is the same mindset — a long LLM generation shouldn't be cut off because nginx assumed it had stalled.

> **Q:** Why path-filter CI workflows?
> **A:** Feedback loop and cost. A doc-only PR shouldn't burn CI minutes booting Python and installing FastAPI. A frontend-only PR shouldn't run pytest. Filters keep the per-PR CI fast and the billing reasonable. The risk — a backend file that should trigger backend CI gets filtered out — is mitigated by always including the workflow file itself in the path list, so workflow changes always run their own job.

> **Q:** Why a non-root user in the container?
> **A:** Defense in depth. Default Docker containers run as root inside the container, which means a container escape exploit lands as root on the host. Adding a dedicated user with `USER app` doesn't prevent the escape — but it limits what a compromised process can do once it's out. It's a one-line change that closes off an entire class of post-exploitation behaviour. Practically every production-shipped container should have it.

> **Q:** Why docker-compose with healthchecks instead of bare `docker run`?
> **A:** Service ordering. The frontend's nginx proxies `/api` to the backend container — if nginx starts before the backend is listening, the first 30 seconds of requests 502. `depends_on.condition: service_healthy` makes compose wait for the backend's healthcheck to pass before starting nginx. The healthchecks also surface "is this thing alive" in `docker compose ps` and in real orchestrators (k8s readiness probes, PaaS deploy gates).

## What's next

Phase 9 is the last of the planned phases. Plausible Phase 10+ work — explicitly out of scope for this milestone, listed here so the gaps are visible:

- **Persistence (Postgres + SQLAlchemy + Alembic).** The repo seam is already the right shape — this is a one-file swap plus a migration.
- **Auth (JWT or OIDC).** Today every request is unauth'd; the repo is global.
- **Multi-resume management UI.** The list endpoint exists; no sidebar consumes it yet.
- **Tool calling / RAG in the chat provider.** The provider abstraction is ready; the orchestration around it isn't.
- **E2E tests (Playwright).** Smoke coverage exists; a real browser test would catch the things MSW can't.
