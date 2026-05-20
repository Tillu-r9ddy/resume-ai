/**
 * ErrorFallback — the UI shown when an error boundary catches a render error.
 *
 * Designed to satisfy `react-error-boundary`'s `FallbackProps` shape so it
 * drops into either our hand-rolled class boundary (components/ErrorBoundary)
 * OR the library boundary in components/Shell.
 *
 * WHY split fallback into its own file?
 *   The fallback UI is part of the *design system*, not the error mechanism.
 *   Separating it lets us reuse the same look across multiple boundaries
 *   (per-route, per-feature, app-shell) without copy-pasting JSX.
 */
import type { FallbackProps } from 'react-error-boundary';

/**
 * `FallbackProps.error` is typed `unknown` — and that's the correct shape:
 * JS lets you `throw` literally anything (`throw 'hi'`, `throw 42`). We narrow
 * to a readable message before rendering so the fallback never blows up while
 * trying to render *another* error.
 */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mx-auto mt-12 max-w-xl rounded-xl border border-red-500/30 bg-red-500/5 p-6"
    >
      <h2 className="text-lg font-semibold text-red-200">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink-muted">
        An error escaped the current view. The rest of the app is still alive — click below to
        retry, or use the sidebar to navigate elsewhere.
      </p>

      {/*
        Show the message in dev so you can debug. In prod you'd hide the raw
        message (could leak internals / PII) and replace it with a generic
        copy + a Sentry event ID for support.
      */}
      {import.meta.env.DEV && (
        <pre className="mt-4 overflow-auto rounded-md bg-canvas p-3 text-xs text-red-200">
          {describe(error)}
        </pre>
      )}

      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-4 rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
      >
        Try again
      </button>
    </div>
  );
}
