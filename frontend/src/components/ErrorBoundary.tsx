/**
 * ErrorBoundary — class-based, the raw React API.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY a class component in 2026, after function components took over?
 * ─────────────────────────────────────────────────────────────────────────────
 *   React has NO hook equivalent for error boundaries. The two lifecycle
 *   methods you must implement (`getDerivedStateFromError` and
 *   `componentDidCatch`) are class-only. The team has signalled an `<ErrorBoundary>`
 *   primitive on the roadmap, but until that ships, every error boundary is
 *   either:
 *     • a class component you write by hand (this file), OR
 *     • the `react-error-boundary` library that wraps the class API.
 *
 *   We keep BOTH in the codebase so you can see the underlying mechanism AND
 *   the ergonomic library version. See routes/Editor.tsx → triggered crash
 *   bubbles up to the library boundary in components/Shell.tsx.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What an error boundary CATCHES vs DOES NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *   ✅ Errors during render
 *   ✅ Errors in lifecycle methods
 *   ✅ Errors in constructors of the whole tree below it
 *   ❌ Event handlers          → wrap in try/catch
 *   ❌ Async code / timers     → wrap in try/catch
 *   ❌ Server-side rendering   → handle on the server
 *   ❌ Errors thrown in the boundary itself → bubbles to parent boundary
 *
 *   This is THE classic React interview question. Memorise the table.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Custom fallback UI. We accept either a static node OR a render function so
   * the fallback can show the actual error message + a retry handler. The
   * library `react-error-boundary` uses the same pattern.
   */
  fallback: ReactNode | ((args: { error: Error; reset: () => void }) => ReactNode);
  /**
   * Optional side-effect when an error is caught — typically used to log to
   * Sentry/Datadog/etc. Kept optional so tests don't have to stub it.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Initial state — no error captured yet.
  override state: ErrorBoundaryState = { error: null };

  /**
   * STATIC method — React calls this with the thrown error and expects you to
   * return the next `state`. Use this to flip the boundary into its error UI.
   *
   * It's static because React needs to derive state BEFORE the instance has
   * been constructed in some cases (server rendering edge cases). Don't put
   * side effects here — use `componentDidCatch` for those.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  /**
   * INSTANCE method — called AFTER the error UI has rendered. Right place for
   * side effects: log to monitoring, fire analytics, etc. The `info` arg has
   * the component stack trace (very useful in Sentry breadcrumbs).
   */
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // In dev, also log to console so you don't miss it.
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] caught:', error, info.componentStack);
    }
  }

  // Reset handler — clears the captured error so children re-mount.
  // The user can wire this to a "Try again" button in the fallback.
  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      return typeof fallback === 'function' ? fallback({ error, reset: this.reset }) : fallback;
    }
    return children;
  }
}
