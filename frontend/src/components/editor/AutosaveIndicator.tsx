/**
 * AutosaveIndicator — small pill showing Saving/Saved next to undo/redo.
 *
 * Reassuring micro-UX: users expect autosave-driven editors to tell them
 * the save happened. The pill animates briefly on each change and settles
 * back to "Saved" — a subtle confirmation without modal pollution.
 *
 * For Phase 4d this is a perceptual cue (localStorage is synchronous).
 * Phase 6 (FastAPI backend) will replace this with real network status:
 * "Saving…" while the request is in flight, "Saved · 12:34 PM" with the
 * last-saved timestamp, "Offline · 3 pending" when network fails.
 */
import { useSavedStatus } from '../../hooks/useSavedStatus';

export function AutosaveIndicator(): React.JSX.Element {
  const status = useSavedStatus();
  const isSaving = status === 'saving';

  return (
    <span
      role="status"
      aria-live="polite"
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        isSaving ? 'bg-accent-soft text-ink' : 'bg-surface-2 text-ink-muted',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'h-1.5 w-1.5 rounded-full',
          isSaving ? 'animate-pulse bg-accent' : 'bg-emerald-400',
        ].join(' ')}
      />
      {isSaving ? 'Saving…' : 'Saved'}
    </span>
  );
}
