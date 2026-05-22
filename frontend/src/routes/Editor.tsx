/**
 * Editor — Phase 4b: real form + live preview.
 *
 * Layout:
 *   • Header row: undo/redo buttons (live with redux-undo's past/future counts)
 *   • Body:      <EditorLayout /> = HeaderForm on the left, Preview on the right
 *   • Footer:    a collapsible <details> with the Phase 4a debug panel +
 *                Phase 2 crash button — kept around for development, hidden
 *                by default so they don't crowd the real UI.
 */
import { useState } from 'react';
import { ActionCreators as UndoActions } from 'redux-undo';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addSection, removeLastSection, resetResume, setResume } from '../store/resumeSlice';
import { SECTION_TYPES, type SectionType } from '../schema/resume';
import { EditorLayout } from '../components/editor/EditorLayout';
import { AutosaveIndicator } from '../components/editor/AutosaveIndicator';
import { benchmarkResume } from '../store/benchmarkResume';

const ADDABLE_SECTIONS: readonly SectionType[] = SECTION_TYPES.filter(
  (t): t is Exclude<SectionType, 'header'> => t !== 'header',
);

export default function Editor(): React.JSX.Element {
  const dispatch = useAppDispatch();

  const pastCount = useAppSelector((s) => s.resume.past.length);
  const futureCount = useAppSelector((s) => s.resume.future.length);
  const sectionCount = useAppSelector((s) => s.resume.present.sections.length);

  const canUndo = pastCount > 0;
  const canRedo = futureCount > 0;

  // Crash button kept from Phase 2 so the error-boundary smoke test still works.
  const [crash, setCrash] = useState(false);
  if (crash) {
    throw new Error('Editor crashed on purpose — testing the error boundary.');
  }

  return (
    <article className="mx-auto w-full max-w-6xl">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Resume editor</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Phase 4b — the Header section is now a real form. Other sections arrive in Phase 4c.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutosaveIndicator />
          <button
            type="button"
            onClick={() => dispatch(UndoActions.undo())}
            disabled={!canUndo}
            className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-soft disabled:opacity-40"
            title={`Undo (${pastCount} past)`}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={() => dispatch(UndoActions.redo())}
            disabled={!canRedo}
            className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-soft disabled:opacity-40"
            title={`Redo (${futureCount} future)`}
          >
            ↷ Redo
          </button>
        </div>
      </header>

      {/* ── Form + Preview ────────────────────────────────────────────── */}
      <div className="mt-6">
        <EditorLayout />
      </div>

      {/* ── Collapsible debug panel ───────────────────────────────────── */}
      <details className="mt-10 rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted">
          Developer tools — dispatch actions · raw state · crash route
        </summary>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Dispatch actions
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADDABLE_SECTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => dispatch(addSection(t))}
                  className="rounded-md bg-accent-soft px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent hover:text-canvas"
                >
                  + Add {t}
                </button>
              ))}
              <button
                type="button"
                onClick={() => dispatch(removeLastSection())}
                disabled={sectionCount === 0}
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft disabled:opacity-40"
              >
                − Remove last
              </button>
              <button
                type="button"
                onClick={() => dispatch(resetResume())}
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20"
              >
                ↺ Reset to seed
              </button>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={() => dispatch(setResume(benchmarkResume()))}
                  className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft"
                  title="Load the Phase 5 benchmark resume (~15 jobs, ~10 projects)"
                >
                  ⚡ Load benchmark
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              sections: {sectionCount} · past: {pastCount} · future: {futureCount}
              {' · '}
              localStorage key:{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5">persist:resume-ai:resume</code>
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Error boundary smoke test
            </h3>
            <button
              type="button"
              onClick={() => setCrash(true)}
              className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20"
            >
              Crash this route
            </button>
          </div>
        </div>
      </details>
    </article>
  );
}
