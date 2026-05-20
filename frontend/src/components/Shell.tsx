/**
 * Shell — the app's persistent layout: sidebar + main content area.
 *
 * Phase 3a: the sidebar is now collapsible and the theme is switchable. Both
 * are driven by useUiStore — the store is the source of truth, the Shell is
 * pure presentation.
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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Store subscription pattern
 * ─────────────────────────────────────────────────────────────────────────────
 *   We deliberately use the three thin selector hooks (`useSidebarCollapsed`,
 *   `useTheme`, `useUiActions`) instead of `useUiStore()`. Each hook subscribes
 *   to ONE slice — React only re-renders the Shell when *its* slice changes.
 *
 *   Subscribing to the full store with `useUiStore()` would re-render this
 *   component on every action even when the displayed values didn't change.
 *   At Shell scale that's invisible; at editor-form scale (hundreds of fields)
 *   it's the difference between snappy and janky.
 */
import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ErrorFallback';
import { RouteSkeleton } from './RouteSkeleton';
import { useSidebarCollapsed, useTheme, useUiActions } from '../stores/useUiStore';

interface NavItem {
  to: string;
  label: string;
  /** Used as the icon glyph when the sidebar is collapsed. Keep to 1–2 chars. */
  glyph: string;
  /** End-match so NavLink only marks "/" active for "/" exactly, not for "/editor". */
  end?: boolean;
}

const NAV: readonly NavItem[] = [
  { to: '/', label: 'Home', glyph: 'H', end: true },
  { to: '/editor', label: 'Editor', glyph: 'E' },
  { to: '/chat', label: 'Chat', glyph: 'C' },
];

export function Shell(): React.JSX.Element {
  const { pathname } = useLocation();
  const collapsed = useSidebarCollapsed();
  const theme = useTheme();
  const { toggleSidebar, toggleTheme } = useUiActions();

  const gridCols = collapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[16rem_1fr]';

  return (
    <div
      className={`grid h-full ${gridCols} bg-canvas text-ink transition-[grid-template-columns] duration-200`}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="flex h-full flex-col border-r border-border bg-surface px-3 py-4">
        <div className="flex items-center justify-between px-2">
          {collapsed ? (
            <span className="text-lg font-semibold text-accent" aria-label="Resume-AI">
              R
            </span>
          ) : (
            <div className="text-lg font-semibold tracking-tight">
              Resume<span className="text-accent">·AI</span>
            </div>
          )}
        </div>
        {!collapsed && <p className="mt-1 px-2 text-xs text-ink-muted">Phase 3a — Zustand</p>}

        <nav className="mt-6 flex flex-col gap-1" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'flex items-center rounded-md text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2',
                  isActive
                    ? 'bg-accent-soft text-ink'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                ].join(' ')
              }
            >
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 items-center justify-center rounded bg-surface-2 text-xs font-bold text-ink"
              >
                {item.glyph}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* ── Footer controls — theme + collapse toggles ──────────────── */}
        <div
          className={`mt-auto flex ${collapsed ? 'flex-col gap-2' : 'items-center justify-between gap-2'}`}
        >
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface-2 px-2 text-xs font-medium text-ink hover:bg-accent-soft"
          >
            {theme === 'dark' ? '☀' : '☾'}
            {!collapsed && (
              <span className="ml-2 capitalize">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-sm text-ink hover:bg-accent-soft"
          >
            {collapsed ? '»' : '«'}
          </button>
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
