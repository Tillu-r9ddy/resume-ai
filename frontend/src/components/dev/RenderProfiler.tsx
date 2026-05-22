/**
 * RenderProfiler — dev-only wrapper around React's <Profiler> API.
 *
 * Why this exists:
 *   Phase 5 work is measure-first. The React DevTools Profiler is the right
 *   tool for deep dives, but it has overhead and is awkward to script
 *   "type these 10 characters and tell me the render count." This component
 *   gives us a lighter sidecar: it tags a tree with an id, accumulates one
 *   commit-count + total-actualDuration row per tag, and exposes
 *   `window.__perf.snapshot()` / `__perf.reset()` for quick before/after
 *   numbers from the browser console.
 *
 * Usage:
 *   In a dev-only branch, wrap the regions you care about:
 *     <RenderProfiler id="EditorLayout"><EditorLayout /></RenderProfiler>
 *     <RenderProfiler id="Preview"><Preview /></RenderProfiler>
 *
 *   In devtools:
 *     __perf.reset();        // zero the counters
 *     // ...type something in a form input...
 *     __perf.snapshot();     // -> { EditorLayout: { commits, ms }, Preview: ... }
 *
 *   The component renders children directly outside DEV — zero runtime cost
 *   in production because the React Profiler import only happens at the top.
 *
 * Why not React.Profiler directly?
 *   Profiler's onRender fires per commit; you'd need accumulation per tree.
 *   This is that accumulation, kept in one place so adding a new probe is a
 *   one-line change.
 */
import { Profiler, type ReactNode } from 'react';

type PerfRow = { commits: number; ms: number };

declare global {
  interface Window {
    __perf?: {
      rows: Record<string, PerfRow>;
      snapshot: () => Record<string, PerfRow>;
      reset: () => void;
    };
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined' && !window.__perf) {
  const rows: Record<string, PerfRow> = {};
  window.__perf = {
    rows,
    snapshot: () => {
      // Pretty-print to the console so the user can read it inline.
      // eslint-disable-next-line no-console
      console.table(rows);
      return { ...rows };
    },
    reset: () => {
      for (const k of Object.keys(rows)) delete rows[k];
      // eslint-disable-next-line no-console
      console.log('[__perf] reset');
    },
  };
}

function record(id: string, actualDuration: number): void {
  const w = typeof window !== 'undefined' ? window.__perf : undefined;
  if (!w) return;
  const row = w.rows[id] ?? { commits: 0, ms: 0 };
  row.commits += 1;
  row.ms += actualDuration;
  w.rows[id] = row;
}

export function RenderProfiler({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): React.JSX.Element {
  if (!import.meta.env.DEV) return <>{children}</>;
  return (
    <Profiler
      id={id}
      onRender={(profilerId, _phase, actualDuration) => record(profilerId, actualDuration)}
    >
      {children}
    </Profiler>
  );
}
