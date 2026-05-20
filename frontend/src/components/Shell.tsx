/**
 * Shell — the app's persistent layout: sidebar + main content area.
 *
 * Mounted as the layout route in router.tsx. Every page renders inside the
 * <Outlet />, so the sidebar, header, and error/suspense boundaries live
 * exactly ONCE in the tree no matter how the user navigates.
 *
 * Composition order (outer → inner):
 *   ErrorBoundary (library)   ← catches render errors in any route
 *     Suspense                ← shows skeleton while route chunk loads
 *       <Outlet />            ← React Router swaps the active route here
 *
 * WHY ErrorBoundary OUTSIDE Suspense and not the other way around?
 *   If Suspense were outside, a render error during the loading state would
 *   tear down the Suspense itself and the skeleton would vanish before the
 *   fallback rendered. With ErrorBoundary outermost, ANY error in the route
 *   subtree (including during suspended rendering) is caught.
 */
import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ErrorFallback';
import { RouteSkeleton } from './RouteSkeleton';

interface NavItem {
  to: string;
  label: string;
  /** End-match so NavLink only marks "/" active for "/" exactly, not for "/editor". */
  end?: boolean;
}

const NAV: readonly NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/editor', label: 'Editor' },
  { to: '/chat', label: 'Chat' },
];

export function Shell(): React.JSX.Element {
  // `useLocation` re-renders the Shell on every navigation. Used as a *key* on
  // ErrorBoundary so a fresh route gets a fresh boundary state — otherwise a
  // crash on /editor would persist as you navigate to /home until you click
  // "Try again". Keying by pathname auto-resets it.
  const { pathname } = useLocation();

  return (
    <div className="grid h-full grid-cols-[16rem_1fr] bg-canvas text-ink">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="flex h-full flex-col border-r border-border bg-surface px-5 py-6">
        <div className="text-lg font-semibold tracking-tight">
          Resume<span className="text-accent">·AI</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">Phase 2 — router + shell</p>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-ink'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto text-xs text-ink-muted">
          <p>Open source · MIT</p>
        </div>
      </aside>

      {/* ── Main content area ───────────────────────────────────────────── */}
      <main className="overflow-auto px-10 py-10">
        <ErrorBoundary key={pathname} FallbackComponent={ErrorFallback}>
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
