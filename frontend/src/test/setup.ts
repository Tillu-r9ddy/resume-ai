/**
 * Test setup — runs once before every test file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What we wire up here
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. @testing-library/jest-dom matchers (toBeInTheDocument, toHaveValue, …)
 *      — Vitest's bare `expect` doesn't know about DOM nodes. This patch adds
 *      readable assertions instead of `expect(el.textContent).toMatch(…)`.
 *
 *   2. MSW (Mock Service Worker) — intercepts `fetch()` at the network layer.
 *      The same handlers we'd use to mock our FastAPI backend in dev are now
 *      the test fixtures. Means a test against `resumesApi.list()` actually
 *      exercises the real fetch wrapper, JSON parsing, and error branching.
 *
 *      `onUnhandledRequest: 'error'` is deliberate: if a test makes a network
 *      call we didn't mock, that's a bug — silent passthrough would let the
 *      test accidentally hit the real backend in CI. Throw loudly.
 *
 *   3. Lifecycle hooks reset MSW handlers between tests so a per-test
 *      `server.use(handler)` override doesn't leak into the next test.
 *
 * Why one setup file and not three?
 *   These three concerns all run once per file and have no dependencies on
 *   each other. Splitting would just add file-jumping noise.
 */
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
