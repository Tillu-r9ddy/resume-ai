/**
 * Home — landing route ("/").
 *
 * Phase 2 placeholder: just enough copy to confirm the route renders inside
 * the Shell layout. Real marketing/onboarding content lands in Phase 4+.
 *
 * WHY a default export?
 *   `React.lazy(() => import('./Home'))` resolves the module's *default* export.
 *   If we used a named export we'd have to write
 *     React.lazy(() => import('./Home').then((m) => ({ default: m.Home })))
 *   which works but is noisy. Default exports are the idiomatic shape for
 *   code-split route components.
 */
import { Link } from 'react-router';

export default function Home(): React.JSX.Element {
  return (
    <article className="prose-invert max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Resume-AI</h1>
      <p className="mt-2 text-ink-muted">
        ATS-friendly resumes, drafted and tailored by a local AI assistant. No LaTeX, no login
        walls, no per-token billing.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-medium text-ink">You are in Phase 2</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Routing, layout, and error boundaries are now live. Try the links in the sidebar — each
          route is a separately-loaded JS chunk.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            to="/editor"
            className="rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
          >
            Open editor →
          </Link>
          <Link
            to="/chat"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Open chat →
          </Link>
        </div>
      </section>
    </article>
  );
}
