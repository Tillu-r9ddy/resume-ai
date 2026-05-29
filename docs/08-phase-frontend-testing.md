# Phase 8 — Frontend Testing (Vitest + RTL + MSW)

> Goal: ship a frontend test setup that's fast to run, covers the network boundary end-to-end, and stays easy to extend. Three tools — Vitest as the runner, React Testing Library for component assertions, MSW for `fetch` interception — wired so the first test in a new file needs zero scaffolding.

## What we built and WHY

### 1. Vitest config inside `vite.config.ts`, not a separate `vitest.config.ts`

```ts
/// <reference types="vitest/config" />
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: { provider: 'v8', ... },
  },
});
```

Why share the config? Vitest reuses Vite's resolver, plugins (`@vitejs/plugin-react` for JSX, `@tailwindcss/vite` for class processing), and aliases. One config means tests resolve modules **exactly** like the production build. No surprise diff between "passes in test, breaks in build".

`environment: 'jsdom'` gives us window/document so React Testing Library can render. `globals: true` makes `describe`, `it`, `expect` available without imports — matches Jest ergonomics and keeps test files terse. `css: false` skips CSS processing in tests (we're not asserting on styles, and skipping cuts the test bootstrap by ~half a second).

### 2. `src/test/setup.ts` — one place for global setup

```ts
import '@testing-library/jest-dom/vitest';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Three concerns, one file:

- **jest-dom matchers** — `toBeInTheDocument`, `toHaveValue`, etc. Vitest's bare `expect` doesn't know about DOM nodes; this patch adds readable assertions.
- **MSW lifecycle** — start the server before any test, reset per-test handler overrides between tests, close on suite teardown.
- **`onUnhandledRequest: 'error'`** — deliberate. If a test makes a network call we didn't mock, that's a bug. Silent passthrough would let a test accidentally hit the real backend in CI.

### 3. `src/test/msw/` — handlers + server

```ts
// handlers.ts
export const handlers = [
  http.get(`${BASE}/api/resumes`, () => HttpResponse.json([seedResume()])),
  http.post(`${BASE}/api/chat`, () => {
    const stream = new ReadableStream({
      start(ctrl) {
        for (const frame of frames)
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        ctrl.close();
      },
    });
    return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  }),
];

// server.ts
export const server = setupServer(...handlers);
```

Why MSW instead of `vi.mock('./api/client')`?

- **Mocking the client module bypasses the fetch wrapper, the URL building, the JSON parsing, the ApiError construction.** A handler mistake in `request<T>()` would never surface in tests.
- **MSW intercepts at the fetch boundary.** The test calls `resumesApi.list()` → it goes through the real `request()` → MSW catches the actual outbound HTTP and returns a fixture. End-to-end coverage of our network code with no real backend.
- **`server.use(http.get(...))` overrides per-test.** Default handlers cover the happy path; tests that need failure cases register their own and `resetHandlers()` cleans up between tests.

The chat handler emits a real SSE stream because the streamChat parser is one of the things we care most about being right. Mocking out the stream and yielding pre-parsed events would miss the buffer-split, the `data:` prefix handling, the `\n\n` boundary — every bug the parser could have.

### 4. Smoke tests — three files, nine tests

- **`api/client.test.ts` (7 tests)** — exercises `resumesApi.list/create/delete/get`, the `ApiError` construction on 404 and 500, and the `streamChat` async generator. Per-test handler overrides force the failure modes.
- **`components/preview/Preview.test.tsx` (2 tests)** — renders the Preview with a per-test Redux store, asserts that header text + skills appear, and that an empty document shows the empty-state message. The per-test store (`configureStore({ reducer: { resume: () => fixture } })`) avoids dragging in redux-persist's rehydration.

Why this distribution? The API client is the network boundary — it's where round-trip bugs hide, and tests are cheap. The Preview is the consolidator — it stitches together every section renderer in one go. Two thin tests there cover a representative slice of the read path. We deliberately don't snapshot-test individual section components — the cost (snapshot churn on every CSS tweak) outweighs the catch rate.

### 5. TypeScript wiring

```jsonc
// tsconfig.app.json
"types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
```

Three type packages so test files don't need their own tsconfig:

- `vite/client` — `import.meta.env` types.
- `vitest/globals` — `describe`, `it`, `expect` available as globals (matches the runtime).
- `@testing-library/jest-dom` — module augmentation for `expect(...).toBeInTheDocument()`.

### 6. Scripts

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

`vitest run` (not `vitest`) is the CI-friendly one — exits when tests finish instead of watching. `vitest` alone is the dev-loop default; coverage is opt-in because v8 instrumentation slows tests by ~30%.

## Acceptance criteria

- ✅ `npm test -w frontend` runs to completion in under 5 s on a cold cache.
- ✅ 9/9 tests pass.
- ✅ Adding a new test file requires zero new imports — `describe`/`it`/`expect`/`render`/`screen` all available.
- ✅ Unhandled fetch in a test throws (loud failure, not silent passthrough).
- ✅ Coverage report generated by `npm run test:coverage` lands in `coverage/`.

## What we deliberately did NOT do

- **Playwright / E2E tests.** Real browser, real backend, real workflow. Valuable, but a separate phase — they have a different runtime profile, different CI cost, and different failure modes (flakiness). For the project's scope (one user, two routes), the smoke tests above cover the regressions that matter.
- **Snapshot testing.** Tempting; mostly a maintenance burden. A test that fires every time we tweak a margin doesn't tell us anything we couldn't see in the diff.
- **Storybook.** Real value for design-system work; we don't have a design system worth cataloguing. The Preview components are the catalogue.
- **`@testing-library/user-event` everywhere.** Installed and available, but the current tests don't need it. The next interaction test (typing into a form, clicking through autosave) will use it; today's tests are happy with `render` + `screen.getByText`.
- **Backend integration in the same suite.** Vitest runs in Node + jsdom; running a real FastAPI alongside would mean docker-compose in test. MSW gives us 95% of the value at 5% of the cost. The `docker.yml` workflow handles the "real stack boots" assertion separately.
- **CI gating on coverage thresholds.** Coverage is a metric, not a target. Gating tends to produce tests that hit lines without asserting behaviour. We'll watch trends instead of failing builds.

## Interview questions Phase 8 prepares you to answer

> **Q:** Why MSW instead of `vi.mock('./api/client')`?
> **A:** Mocking the module bypasses the actual fetch wrapper — the URL building, JSON parsing, error class construction. A regression in `request<T>()` would pass every test that mocked at the module level. MSW intercepts at the network layer, so the test still calls `resumesApi.list()` and that still goes through the real client; the mock only stands in for the upstream HTTP. End-to-end coverage of network code without a real backend.

> **Q:** Why share Vite's config with Vitest?
> **A:** One resolver, one plugin set, one alias map. Tests resolve modules exactly like production. The alternative — a separate `vitest.config.ts` — invites drift: a tsconfig path alias works in src but not in tests, or vice versa. The cost of sharing is one `/// <reference types="vitest/config" />` line; the benefit is the entire "but it passes locally" class of bug disappears.

> **Q:** Why a jsdom environment instead of happy-dom?
> **A:** Defaults. jsdom is the older, more compatible option — anything that ran in Jest runs here. happy-dom is faster but has occasional API gaps (esp. around forms and selection APIs). For a project that's not bottlenecked on test runtime, the compatibility margin is worth more than the speed delta. We can swap later by changing one config key.

> **Q:** What does `onUnhandledRequest: 'error'` buy you?
> **A:** Loud failure. A test that accidentally hits a real URL (e.g., someone added a new endpoint and forgot to mock it) would silently make a real network call in CI — slow, flaky, and a security risk if the URL points anywhere real. Erroring on unhandled requests turns that into a clear test failure with a stack trace pointing at the offender.

> **Q:** Why test the Preview component instead of each PreviewXxx renderer individually?
> **A:** The Preview is where the integration risk lives — section dispatcher, selector wiring, empty-state branching. Testing each PreviewXxx in isolation would mostly test the section's HTML, which the design changes more often than the behaviour does. One Preview test that covers a representative document gets us regression coverage of the entire read path for a fraction of the assertion churn.

## What's next: Phase 9 — CI/CD

- Frontend CI updated to run `npm test -w frontend`.
- Backend + frontend Dockerfiles (multi-stage, non-root).
- `docker-compose.yml` for the prod-shaped local stack.
- `docker.yml` workflow that proves the compose stack boots.
