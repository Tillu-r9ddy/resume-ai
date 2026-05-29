# ──────────────────────────────────────────────────────────────────────────────
# frontend/Dockerfile — multi-stage: Node builds, nginx serves.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY nginx (not `vite preview`, not `serve`)?
# ─────────────────────────────────────────────────────────────────────────────
#   `vite preview` is a Node process — uses ~80 MB RAM idle and can't compete
#   with nginx on static-file throughput. For a SPA that's just shipping a
#   `dist/` folder, nginx is the canonical choice: 5 MB image footprint, C
#   throughput, free gzip, free HTTP/2.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY a /api proxy block in nginx?
# ─────────────────────────────────────────────────────────────────────────────
#   We serve frontend + backend behind one origin in compose / prod. Same
#   origin means no CORS preflights and no `VITE_API_BASE_URL` to leak the
#   internal hostname. The conf below proxies /api/* to the backend service
#   and serves everything else from dist/.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY copy npm + package-lock first, install, THEN copy source?
# ─────────────────────────────────────────────────────────────────────────────
#   Standard Docker layer-cache pattern. `npm ci` is the slowest step. If
#   only source code changes (the common case), the install layer is reused
#   from cache and the build takes seconds instead of minutes.
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

# Copy package manifests for the workspace root + frontend so `npm ci`
# resolves correctly. The frontend is an npm workspace under the repo root,
# so we need both lockfile and root package.json.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

RUN npm ci --workspaces --include-workspace-root

# Copy source last — invalidates only the build layer when source changes.
COPY frontend ./frontend

# Production build. Vite writes to /build/frontend/dist.
RUN npm run build -w frontend

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Replace the default config with ours (SPA fallback + /api proxy).
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Wipe the default index.html and drop our build in. Using --chown is not
# supported on COPY --from, so we leave ownership to nginx's default user.
COPY --from=builder /build/frontend/dist /usr/share/nginx/html

# nginx images already have a HEALTHCHECK-friendly default; we add one
# explicitly so docker-compose can detect "the SPA is up" without relying on
# external probes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

EXPOSE 80
