/**
 * Editor — Phase 4a debug panel.
 *
 * Why a debug panel and not the real editor UI?
 *   Phase 4a's job is to land the data model + store + undo + persistence
 *   correctly. Wiring a full form UI on top of a half-baked store inevitably
 *   leaks slice quirks into JSX and creates churn. So we ship the store with
 *   a minimal control surface: dispatch actions via buttons, see the result
 *   as raw JSON. Phase 4b replaces this body with React Hook Form binding.
 *
 * What's here:
 *   • Section-add buttons (one per SectionType except header — Header is a
 *     singleton and seeded once).
 *   • Remove-last + Reset buttons to demonstrate destructive actions and
 *     prove undo restores them.
 *   • Undo / Redo buttons backed by redux-undo's ActionCreators.
 *   • Live <pre> view of `state.resume.present` so you can watch the store
 *     change in real time.
 *   • The Phase 2 "crash this route" smoke test stays — it has nothing to do
 *     with the editor but confirms the error boundary still works inside the
 *     newly-Provider-wrapped tree.
 */
import { useState } from 'react';
import { ActionCreators as UndoActions } from 'redux-undo';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addSection, removeLastSection, resetResume } from '../store/resumeSlice';
import { SECTION_TYPES, type SectionType } from '../schema/resume';

// Header is a singleton — adding more would violate the schema invariant.
// Filter it out of the "Add section" controls.
const ADDABLE_SECTIONS: readonly SectionType[] = SECTION_TYPES.filter(
  (t): t is Exclude<SectionType, 'header'> => t !== 'header',
);

export default function Editor(): React.JSX.Element {
  const dispatch = useAppDispatch();

  // Subscribe to the *current* resume — past/future are visible too but we
  // don't render them. We use selector functions instead of `state.resume`
  // so any unrelated state change (none today) wouldn't re-render this view.
  const resume = useAppSelector((s) => s.resume.present);
  const pastCount = useAppSelector((s) => s.resume.past.length);
  const futureCount = useAppSelector((s) => s.resume.future.length);

  const canUndo = pastCount > 0;
  const canRedo = futureCount > 0;

  // Crash button kept from Phase 2 so the error boundary smoke test still works.
  const [crash, setCrash] = useState(false);
  if (crash) {
    throw new Error('Editor crashed on purpose — testing the error boundary.');
  }

  return (
    <article className="max-w-4xl">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Resume editor — Phase 4a debug panel
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Real form UI lands in Phase 4b. For now: dispatch actions, watch the store. Undo / redo
            work across every button below.
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <section className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-medium text-ink">Dispatch actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {ADDABLE_SECTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => dispatch(addSection(t))}
              className="rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
            >
              + Add {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => dispatch(removeLastSection())}
            disabled={resume.sections.length === 0}
            className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-soft disabled:opacity-40"
          >
            − Remove last
          </button>
          <button
            type="button"
            onClick={() => dispatch(resetResume())}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20"
          >
            ↺ Reset to seed
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Open Redux DevTools (browser extension) to watch actions in the timeline. localStorage
          key: <code className="rounded bg-surface-2 px-1.5 py-0.5">resume-ai:resume</code>.
        </p>
      </section>

      {/* ── State view ────────────────────────────────────────────────── */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-medium text-ink">
          state.resume.present{' '}
          <span className="ml-2 text-xs font-normal text-ink-muted">
            (sections: {resume.sections.length} · past: {pastCount} · future: {futureCount})
          </span>
        </h2>
        <pre className="mt-3 max-h-[480px] overflow-auto rounded-md bg-canvas p-4 text-xs text-ink">
          {JSON.stringify(resume, null, 2)}
        </pre>
      </section>

      {/* ── Error-boundary smoke test (Phase 2 carry-over) ────────────── */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-medium text-ink">Error boundary smoke test</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Confirms the Phase 2 error boundary still catches inside the Redux-Provider-wrapped tree.
        </p>
        <button
          type="button"
          onClick={() => setCrash(true)}
          className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/20"
        >
          Crash this route
        </button>
      </section>
    </article>
  );
}
