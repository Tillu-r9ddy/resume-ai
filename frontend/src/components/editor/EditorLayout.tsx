/**
 * EditorLayout — the editor's two-pane shell.
 *
 *   ┌──────────────┬──────────────┐
 *   │  Form pane   │ Preview pane │
 *   │  (60%)       │   (40%)      │
 *   └──────────────┴──────────────┘
 *
 * Why a separate layout component (instead of putting the grid in
 * routes/Editor.tsx)?
 *   • Editor.tsx will grow other concerns (undo/redo header, debug panel,
 *     section navigator in 4d). Keeping the form/preview split here keeps
 *     each file's responsibility narrow.
 *   • Storybook-friendly: in Phase 8 we'll mount EditorLayout in isolation
 *     with a mock store; the route file isn't suited to that.
 *
 * Phase 4b ships ONE form (HeaderForm). 4c expands the left pane into a
 * vertically-stacked list of section forms, optionally with a left rail
 * for section navigation.
 */
import { HeaderForm } from './HeaderForm';
import { Preview } from '../preview/Preview';

export function EditorLayout(): React.JSX.Element {
  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      {/* ── Form pane ──────────────────────────────────────────────────── */}
      <section
        aria-label="Resume editor"
        className="rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Header</h2>
        <p className="mt-1 text-xs text-ink-muted">
          The top of your resume — name, contact line, links. Changes commit on blur and update the
          preview pane.
        </p>
        <div className="mt-5">
          <HeaderForm />
        </div>
      </section>

      {/* ── Preview pane ───────────────────────────────────────────────── */}
      <section aria-label="Resume preview" className="lg:sticky lg:top-6 lg:self-start">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Preview
        </h2>
        <Preview />
      </section>
    </div>
  );
}
