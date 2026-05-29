# ──────────────────────────────────────────────────────────────────────────────
# backend/Dockerfile — multi-stage build for the FastAPI service.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY multi-stage?
# ─────────────────────────────────────────────────────────────────────────────
#   Stage 1 ("builder") installs build toolchain + compiles the wheel. It's
#   ~250 MB. Stage 2 ("runtime") copies only the installed site-packages and
#   the source — no gcc, no headers, no pip cache. Final image is ~120 MB
#   instead of ~400 MB. Smaller images push faster, pull faster, and have a
#   smaller CVE surface for security scans to chew on.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY python:3.13-slim (not -alpine, not full)?
# ─────────────────────────────────────────────────────────────────────────────
#   alpine ships musl libc — wheels built for glibc (the vast majority) don't
#   work, so pip falls back to building from source. That's slow AND bloats
#   the "small" image with a C toolchain. -slim is debian-slim: glibc, modern
#   Python, no docs/manpages, no gcc. The sweet spot for Python services.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY a non-root user?
# ─────────────────────────────────────────────────────────────────────────────
#   Default Docker runs PID 1 as root. A container escape exploit then runs
#   as root on the host. Adding `app` user + USER directive means a
#   compromised process can't write to /etc or rummage in /root.
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Copy only metadata first so Docker caches the dep install layer when the
# source changes but pyproject.toml doesn't. Standard layer-cache trick.
COPY pyproject.toml README.md ./
COPY app ./app

# Install into a venv we'll copy whole into the runtime image. Using a venv
# (instead of --user or /usr/local site-packages) keeps the install path
# predictable across base-image versions.
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install .

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Non-root user — see top-of-file rationale.
RUN groupadd --system app && useradd --system --gid app --home /home/app app \
    && mkdir -p /home/app && chown app:app /home/app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app app ./app

USER app
EXPOSE 8000

# Healthcheck — docker-compose surfaces this and the orchestrator (k8s,
# Render, Railway) reads it to decide if the container is alive. Pointed at
# /api/health which is cheap and dep-free.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else sys.exit(1)" \
    || exit 1

# uvicorn directly (not via gunicorn) because:
#   • The workload is async-heavy (SSE streams). gunicorn's sync workers
#     don't help; uvicorn's event loop is what we want.
#   • Horizontal scaling is the orchestrator's job — running multiple
#     replicas of this image is the prod story, not multi-worker single
#     containers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
