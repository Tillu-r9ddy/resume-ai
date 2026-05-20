/**
 * Router configuration — React Router v7.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why React Router v7 instead of v6 or TanStack Router?
 * ─────────────────────────────────────────────────────────────────────────────
 *   • v7 is the de-facto SPA router; every job listing mentions it.
 *   • v7 merged Remix's data APIs into RR — same loaders/actions API we'd
 *     learn for Remix, transferable knowledge.
 *   • TanStack Router has nicer types but a smaller community; we'll show it
 *     in Phase 9 as a comparison, not the default.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `createBrowserRouter` vs `<BrowserRouter>`
 * ─────────────────────────────────────────────────────────────────────────────
 *   v7's *data router* (`createBrowserRouter` + `RouterProvider`) unlocks:
 *     • route-level loaders & actions
 *     • route-level error elements (Router catches throws without our boundary)
 *     • deferred data / streaming
 *     • lazy() routes that include their own loader/element
 *   The legacy `<BrowserRouter>` JSX form is only kept for backwards compat.
 *   Use the data router on new code. Always.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `lazy: () => import(...)` — route-level code splitting
 * ─────────────────────────────────────────────────────────────────────────────
 *   v7 has a first-class `lazy` field on route objects. The router only
 *   imports the module the first time the user navigates to that route. Vite
 *   sees the dynamic `import()` and produces a SEPARATE JS chunk per route in
 *   the build output (`dist/assets/Home-*.js`, `Editor-*.js`, etc.).
 *
 *   Net effect: the initial bundle stays small. Users only pay for the routes
 *   they actually visit. This is the single biggest perf win you can ship on
 *   a SPA — and it's a one-liner per route.
 */
import { createBrowserRouter } from 'react-router';
import { Shell } from './components/Shell';
import { RouterErrorBoundary } from './components/RouterErrorBoundary';

export const router = createBrowserRouter([
  {
    // The layout route — `path: '/'` + children that render in Shell's <Outlet />.
    path: '/',
    Component: Shell,
    /**
     * `ErrorBoundary` on a *data* route catches errors that escape any
     * component-level boundary. Two layers, two purposes:
     *   • react-error-boundary inside Shell → render errors in a route
     *   • this router-level boundary       → loader/action/lazy() errors (Phase 3+)
     */
    ErrorBoundary: RouterErrorBoundary,
    children: [
      {
        // `index: true` → render this child when the URL is exactly "/".
        index: true,
        lazy: async () => {
          const { default: Component } = await import('./routes/Home');
          return { Component };
        },
      },
      {
        path: 'editor',
        lazy: async () => {
          const { default: Component } = await import('./routes/Editor');
          return { Component };
        },
      },
      {
        path: 'chat',
        lazy: async () => {
          const { default: Component } = await import('./routes/Chat');
          return { Component };
        },
      },
      {
        // "*" matches anything not matched above → 404.
        path: '*',
        lazy: async () => {
          const { default: Component } = await import('./routes/NotFound');
          return { Component };
        },
      },
    ],
  },
]);
