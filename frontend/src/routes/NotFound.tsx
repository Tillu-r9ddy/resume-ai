/**
 * NotFound — catch-all 404 route ("*").
 *
 * Mounted at path "*" inside the Shell layout so the sidebar stays visible
 * even for unknown URLs. That's a UX choice: users can navigate away without
 * having to hit the back button.
 *
 * WHY a real route component instead of just returning a 404 in the layout?
 *   Decoupled URLs are easier to test, link to, and instrument (analytics on
 *   404s tell you about broken inbound links). Keeping it as its own route
 *   also lets us add features like "Did you mean…?" suggestions later.
 */
import { Link, useLocation } from 'react-router';

export default function NotFound(): React.JSX.Element {
  const location = useLocation();

  return (
    <article className="max-w-xl">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 text-ink-muted">
        Nothing lives at{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm">{location.pathname}</code>. Try
        one of the routes in the sidebar.
      </p>

      <Link
        to="/"
        className="mt-6 inline-block rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
      >
        ← Back home
      </Link>
    </article>
  );
}
