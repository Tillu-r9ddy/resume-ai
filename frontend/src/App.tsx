/**
 * App — the root component.
 *
 * In Phase 1 this is just a placeholder welcome screen so we can verify the
 * toolchain works end-to-end (Vite serves, TS compiles, ESLint passes, etc.).
 *
 * In Phase 2 we'll replace its body with React Router's <RouterProvider> and
 * actual route configuration. Don't optimize this file yet — it WILL be deleted.
 */

import './App.css';

function App(): React.JSX.Element {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Resume-AI</h1>
        <p className="tagline">ATS-friendly resumes, written with an AI chat assistant.</p>
      </header>
      <section className="phase-marker">
        <p>
          You are looking at <strong>Phase 1: Foundation</strong>.
        </p>
        <ul>
          <li>Vite + React 19 + TypeScript ✓</li>
          <li>Strict ESLint + Prettier ✓</li>
          <li>
            Path aliases (<code>@/*</code>) ✓
          </li>
          <li>Conventional Commits enforced by Husky + commitlint ✓</li>
          <li>Parallel learning-only webpack.config.js ✓</li>
        </ul>
        <p>Next up — Phase 2: React Router with route-based code splitting and Suspense.</p>
      </section>
    </main>
  );
}

/**
 * WHY `export default`?
 *   React Refresh (Vite's HMR plugin) needs components to be the SOLE default
 *   export of their file for state preservation to work reliably. The
 *   eslint-plugin-react-refresh rule enforces this — if you mix named exports
 *   with components, you'll see a lint warning telling you HMR will break.
 *
 * Default-export trade-off: harder to find usages (no symbol name to grep).
 * In Phase 3+ we'll switch to named exports for non-route components.
 */
export default App;
