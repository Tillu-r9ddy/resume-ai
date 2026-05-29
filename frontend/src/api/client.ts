/**
 * api/client.ts — thin HTTP wrapper for the FastAPI backend.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a hand-rolled fetch wrapper instead of axios/RTK Query?
 * ─────────────────────────────────────────────────────────────────────────────
 *   The resume document already lives in a Redux slice wrapped by redux-undo
 *   and redux-persist. Adding RTK Query on top would either (a) duplicate the
 *   document into a cache that fights the existing one, or (b) require
 *   rewiring the store. Neither is worth the abstraction for the four
 *   endpoints we actually call.
 *
 *   This client is ~50 lines of plain fetch with two affordances: a typed
 *   error class so callers can branch on status code, and a base URL
 *   constant that defaults to '' (same origin) for production and overrides
 *   to http://localhost:8000 via VITE_API_BASE_URL during dev.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why `VITE_API_BASE_URL` as a build-time env var (not runtime config)?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Vite inlines `import.meta.env.*` constants into the bundle at build
 *   time. That's right for the API host because the deployment topology
 *   (frontend served from nginx, backend at /api) is fixed per-environment
 *   and changing it requires a redeploy anyway. Runtime config (fetch
 *   /config.json first) is more flexible but buys nothing here.
 */

/**
 * Base URL for /api calls.
 *
 * Three resolutions, in order:
 *   1. `VITE_API_BASE_URL` env var — explicit override for dev (`.env.local`).
 *   2. `import.meta.env.DEV` → 'http://localhost:8000' — sensible default
 *      so a fresh clone with no env file still talks to the local backend.
 *   3. '' — production / preview: hit the same origin (nginx proxies /api
 *      to the backend container).
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

/**
 * Typed error so callers can distinguish 404 ("resume gone") from network
 * errors ("backend down") without parsing the message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  // 204 No Content — return undefined cast as T. Trying to call .json() here
  // throws on an empty body, which is the surprise this branch heads off.
  if (response.status === 204) return undefined as T;

  // Parse JSON regardless of status — the FastAPI error responses are JSON
  // too and the caller may want to read `.body` on an ApiError.
  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    let detail = response.statusText;
    if (body && typeof body === 'object' && 'detail' in body) {
      detail = String((body as { detail: unknown }).detail);
    }
    throw new ApiError(detail, response.status, body);
  }

  return body as T;
}

// ── Resume CRUD ─────────────────────────────────────────────────────────────

import type { Resume as LocalResume } from '../schema/resume';

/**
 * Server-side shape — adds server-assigned fields. Kept separate from the
 * local `Resume` type so the rest of the app keeps working without knowing
 * about timestamps (they're only relevant in the "list resumes" sidebar
 * we'll add later).
 */
export interface RemoteResume extends LocalResume {
  created_at: string;
  updated_at: string;
}

export const resumesApi = {
  list: (): Promise<RemoteResume[]> => request('/api/resumes'),
  get: (id: string): Promise<RemoteResume> => request(`/api/resumes/${id}`),
  create: (body: { title: string; sections: LocalResume['sections'] }): Promise<RemoteResume> =>
    request('/api/resumes', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: string,
    body: { title: string; sections: LocalResume['sections'] },
  ): Promise<RemoteResume> =>
    request(`/api/resumes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string): Promise<void> => request(`/api/resumes/${id}`, { method: 'DELETE' }),
};

// ── Health ──────────────────────────────────────────────────────────────────

export interface Health {
  status: string;
  version: string;
  env: string;
}
export const healthApi = {
  check: (): Promise<Health> => request('/api/health'),
};

// ── Chat (SSE) ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Server SSE frames. The wire format is `data: <json>\n\n` and the JSON
 * always has a `type` discriminator. Keeping the union narrow here means
 * exhaustive handling in the consumer is a compile-time check.
 */
export type ChatStreamEvent =
  | { type: 'token'; value: string }
  | { type: 'done' }
  | { type: 'error'; value: string };

/**
 * Stream chat tokens from the backend.
 *
 * Why an async generator (`AsyncGenerator<ChatStreamEvent>`) instead of an
 * onToken callback?
 *   Generators give the caller back-pressure for free — they pull events
 *   on `for await ... of`, so a slow consumer naturally throttles the
 *   reader. Callbacks invert control and make cancellation messy.
 *
 * Why no EventSource?
 *   EventSource only supports GET. Our request body is a conversation
 *   history that may be many KB. Fetch + getReader gives us POST with
 *   streamed responses, which is what every modern browser supports
 *   except very old Edge.
 */
export async function* streamChat(
  messages: ChatMessage[],
  init?: { signal?: AbortSignal },
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal: init?.signal,
  });

  if (!response.ok || !response.body) {
    throw new ApiError(`Chat request failed: ${response.status}`, response.status, null);
  }

  // TextDecoderStream pipes bytes → text without us re-implementing UTF-8
  // boundary handling (a real bug if a multi-byte char straddles a chunk).
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      // SSE frames are separated by blank lines. Buffer until we see one,
      // then process every complete frame in the buffer.
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
        const rawFrame = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        // Each frame can have multiple `data:` lines per SSE spec; we
        // concatenate. In practice the server emits a single line per frame.
        const dataLines = rawFrame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice('data:'.length).trim());
        if (dataLines.length === 0) continue;

        const json = dataLines.join('\n');
        try {
          const event = JSON.parse(json) as ChatStreamEvent;
          yield event;
          if (event.type === 'done') return;
        } catch {
          // Bad frame: skip. We could yield an error event here but the
          // server is the only producer and it always emits valid JSON.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
