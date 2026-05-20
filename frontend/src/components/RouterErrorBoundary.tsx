/**
 * RouterErrorBoundary — error UI for *router-level* failures.
 *
 * The data router (createBrowserRouter) catches errors thrown by:
 *   • route loaders / actions (Phase 3+)
 *   • lazy() chunk fetches that fail (network blip while loading a route chunk)
 *   • the route component's own render (after our react-error-boundary inside
 *     Shell, this is the safety net of last resort)
 *
 * React Router exposes whatever was thrown via the `useRouteError` hook. We
 * adapt it to ErrorFallback's `{error, resetErrorBoundary}` shape so the same
 * visual fallback works in both worlds.
 *
 * `reset` navigates home — it's the most useful escape hatch when a route
 * itself is broken (clicking "retry" on the same broken route is pointless).
 */
import { useNavigate, useRouteError } from 'react-router';
import { ErrorFallback } from './ErrorFallback';

export function RouterErrorBoundary(): React.JSX.Element {
  const error = useRouteError();
  const navigate = useNavigate();

  return (
    <ErrorFallback
      error={error}
      resetErrorBoundary={() => {
        navigate('/', { replace: true });
      }}
    />
  );
}
