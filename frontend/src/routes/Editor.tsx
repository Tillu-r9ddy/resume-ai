/**
 * Editor — placeholder for the resume editor route ("/editor").
 *
 * In Phase 4 this becomes the React Hook Form + Zod schema-driven editor with
 * field arrays, drag-to-reorder sections, and live preview.
 *
 * For Phase 2 we just need *a component that takes a moment to load* so we can
 * see Suspense fallbacks render. We simulate that by importing a chunky-ish
 * module here — no need, the dynamic import already produces a separate chunk,
 * which means the browser must fetch it on first navigation. That fetch is
 * the natural opportunity for our Suspense boundary to show its skeleton.
 */
import { useState } from 'react';

export default function Editor(): React.JSX.Element {
  // Stub state — proves the route mounts and React is wired correctly.
  // We use this to demo the *intentional crash* button below for the error boundary.
  const [crash, setCrash] = useState(false);
  if (crash) {
    // The error boundary in components/ErrorBoundary.tsx catches this.
    // WHY throw during render rather than from an event handler?
    //   React error boundaries only catch errors thrown during *render*, in
    //   *lifecycle methods*, and in *constructors*. They do NOT catch errors
    //   inside event handlers, async code, or setTimeout callbacks — those
    //   you handle with try/catch or react-error-boundary's `useErrorBoundary`.
    //   We toggle state in onClick and throw in render to satisfy that rule.
    throw new Error('Editor crashed on purpose — testing the error boundary.');
  }

  return (
    <article className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Resume editor</h1>
      <p className="mt-2 text-ink-muted">
        Phase 2 stub. In Phase 4 this becomes the schema-driven form (React Hook Form + Zod) with
        field arrays, drag-to-reorder, and live preview.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-medium text-ink">Error boundary smoke test</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Click the button to throw an error during render. The route should be replaced by the
          fallback UI instead of unmounting the whole app.
        </p>
        <button
          type="button"
          onClick={() => setCrash(true)}
          className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20"
        >
          Crash this route
        </button>
      </div>
    </article>
  );
}
