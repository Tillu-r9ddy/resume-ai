# Phase 2 — Router, Shell, Suspense, Error Boundaries, Tailwind

> Goal: turn the Phase 1 skeleton into a real navigable app. Multiple routes, a persistent layout, lazy-loaded chunks, two flavours of error boundary, and Tailwind for styling.

## What we set up and WHY each piece exists

### 1. React Router v7 with the data router (`createBrowserRouter`)

- `src/router.tsx` builds a single route tree and exports it; `App.tsx` mounts it via `<RouterProvider>`.
- **Why the data router and not `<BrowserRouter>`?** The data router unlocks route-level loaders/actions (Phase 3+), route-level error elements, deferred data, and `lazy()` routes that include their own loader/element. The legacy JSX `<BrowserRouter>` is kept for backwards compat only; nothing new should use it.
- **Why React Router v7 over TanStack Router or Next's router?** v7 is the de-facto SPA router in 2026 — every job posting mentions it. v7 absorbed Remix's data APIs, so what you learn here transfers directly to Remix.

### 2. Route-level code splitting via `lazy: async () => ({ Component })`

- Each route in `router.tsx` uses the v7 `lazy` field with a dynamic `import()`.
- Vite sees those dynamic imports at build time and emits one JS chunk per route (`Home-*.js`, `Editor-*.js`, `Chat-*.js`, `NotFound-*.js`).
- **Why it matters:** users only download the routes they visit. Initial bundle stays small; first paint stays fast. Cheapest perf win on a SPA, full stop.

### 3. A persistent Shell layout (sidebar + main)

- `components/Shell.tsx` is the layout route. Children render in `<Outlet />`, so the sidebar/nav/header live exactly ONCE in the tree regardless of navigation.
- `NavLink` (vs `Link`) gives us `isActive` callbacks for free — used for the highlighted "current page" style on the sidebar.

### 4. `<Suspense>` boundary for lazy routes

- The `<Outlet />` is wrapped in `<Suspense fallback={<RouteSkeleton />}>`.
- `React.lazy` (and v7's `lazy`) suspend rendering while the chunk downloads — the closest Suspense boundary up the tree decides what to show.
- **Why skeletons over spinners?** Skeletons set the visual expectation that real content is coming, feel faster, and reduce layout shift (CLS) because they reserve space.

### 5. Two error-boundary flavours, both in the tree

- **`components/ErrorBoundary.tsx`** — hand-rolled class component using `getDerivedStateFromError` + `componentDidCatch`. It's the teaching artifact: you should understand the underlying API even if you reach for the library 99% of the time.
- **`react-error-boundary`** — used in `Shell` to wrap the `<Outlet />`. Ergonomic API (`FallbackComponent`, `resetErrorBoundary` injected as a prop), well-maintained, ~1 KB.
- **`RouterErrorBoundary`** — adapter for the data router's `ErrorBoundary` field. Catches things that escape component-level boundaries (loader failures, lazy chunk fetch failures).
- **Why so many layers?** Each catches a different class of error. The component boundary catches render errors _inside_ a route; the router boundary catches failures _outside_ render (loaders, chunk fetches). Both layers means a single failure mode never crashes the whole app.
- **Why `key={pathname}` on the boundary?** Navigating away from a crashed route should reset its error state. Re-keying the boundary on pathname change forces React to remount it fresh.

### 6. Tailwind CSS v4 via `@tailwindcss/vite`

- One plugin in `vite.config.ts`, one `@import "tailwindcss";` at the top of `index.css`. Zero `tailwind.config.js`.
- **Why v4 over v3?** v4 ships its own engine on top of Lightning CSS — faster, smaller output, CSS-first config (`@theme` directive) so design tokens become real CSS custom properties usable anywhere.
- **Design tokens defined in CSS, not JS:** `--color-canvas`, `--color-surface`, etc. They become utility classes (`bg-canvas`, `text-ink-muted`) AND custom properties (`var(--color-canvas)`) — single source of truth.

### 7. The four-route map

| Path      | Component  | Purpose                                                     |
| --------- | ---------- | ----------------------------------------------------------- |
| `/`       | `Home`     | Landing page with links to the other routes.                |
| `/editor` | `Editor`   | Phase 4 placeholder. Has a "crash this route" button.       |
| `/chat`   | `Chat`     | Phase 6 placeholder. Real SSE chat lands with the backend.  |
| `*`       | `NotFound` | Catch-all 404. Renders inside the Shell so nav still works. |

## Phase 2 acceptance criteria

- ✅ `npm install` still succeeds at repo root.
- ✅ `npm run dev` serves the app, sidebar is visible, all four routes load.
- ✅ DevTools → Network shows a NEW JS chunk download the first time each route is visited.
- ✅ "Crash this route" on `/editor` shows the ErrorFallback, not a blank screen.
- ✅ Navigating away from a crashed route auto-resets the boundary (no manual "Try again" needed).
- ✅ `npm run lint`, `npm run typecheck`, `npm run build` all pass.
- ✅ `dist/` contains one chunk per route (verified above: `Home-*.js`, `Editor-*.js`, `Chat-*.js`, `NotFound-*.js`).

## Interview questions Phase 2 prepares you to answer

> **Q:** Why use `createBrowserRouter` instead of `<BrowserRouter>`?
> **A:** The data router unlocks loaders, actions, route-level error elements, deferred data, and `lazy()` routes with their own elements/loaders. The JSX router is the legacy form kept for backwards compat — new code should use the data router.

> **Q:** How does React Router v7 do code splitting?
> **A:** Each route can declare a `lazy: async () => ({ Component })` function with a dynamic `import()`. Vite/webpack sees the dynamic import and emits a separate JS chunk per route. The router only fetches the chunk on first navigation to that route.

> **Q:** What errors does an error boundary catch — and what doesn't it?
> **A:** It catches errors thrown during render, in lifecycle methods, and in constructors of the subtree below it. It does NOT catch errors in event handlers, async code (timers, promises), or SSR — those need try/catch or `useErrorBoundary` from `react-error-boundary`.

> **Q:** Why is an error boundary still a class component in 2026?
> **A:** React has no hook equivalent for `getDerivedStateFromError` / `componentDidCatch` yet. A primitive `<ErrorBoundary>` is on the roadmap but until it lands, you either write the class yourself or use `react-error-boundary`, which wraps the class API.

> **Q:** Why put `<Suspense>` inside an `<ErrorBoundary>` and not the other way around?
> **A:** If Suspense were outside, a render error during the loading state would tear down the Suspense itself and the skeleton would vanish before the fallback rendered. With the error boundary outermost, ANY error in the subtree — including during suspended rendering — is caught and the fallback shows.

> **Q:** What's the difference between Tailwind v3 and v4?
> **A:** v4 ships a new engine on Lightning CSS (faster builds), uses a single `@import "tailwindcss";` instead of the three `@tailwind` directives, moves config from `tailwind.config.js` into CSS via `@theme`, auto-discovers source files, and exposes theme tokens as native CSS custom properties.

> **Q:** Why does `Shell` key the ErrorBoundary on `pathname`?
> **A:** A captured error persists in the boundary's state until you call `reset`. Navigating to a new route shouldn't carry a previous route's error UI with it — re-keying on `pathname` forces React to remount the boundary fresh on each navigation.

## What's next: Phase 3

State management tour, one library per problem so you can argue for/against each:

- **Zustand** — global UI state (sidebar collapsed, theme, modal open). Tiny API, no provider.
- **Redux Toolkit + RTK Query** — for the resume-document store + REST-shaped APIs.
- **TanStack Query** — server state for the chat history / template gallery.
- **Jotai** — atomic state for the editor's per-field reactive updates.
- **Context** — used sparingly, only for truly app-global config (locale, theme).

Each library gets its own deep-dive doc explaining when to reach for it and when _not_ to.
