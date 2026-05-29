/**
 * MSW server — the Node-side request interceptor used by Vitest.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why MSW instead of vi.mock('./api/client')?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Mocking the client module means the test bypasses the fetch wrapper, the
 *   URL building, the JSON parsing, and the ApiError construction. A handler
 *   mistake in `request<T>()` would never surface in tests.
 *
 *   MSW intercepts at the fetch boundary. The test still calls
 *   `resumesApi.list()` → it still goes through `request()` → MSW catches the
 *   actual outbound HTTP and returns a fixture. End-to-end coverage of our
 *   network code with no real backend.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a separate server file (not inline in setup.ts)?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Tests will `import { server } from '../test/msw/server'` and call
 *   `server.use(...)` to register per-test handlers (e.g. to force a 500).
 *   Sharing the singleton means those overrides survive long enough to run
 *   and the global `afterEach` reset clears them again.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
