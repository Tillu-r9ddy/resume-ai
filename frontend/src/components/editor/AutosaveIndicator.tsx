/**
 * AutosaveIndicator — small pill showing the backend save status.
 *
 * Phase 6d wired this to the real /api/resumes endpoint via
 * useBackendAutosave. The local "saving for 600ms then saved" perceptual
 * cue is gone — every state here corresponds to a real network result.
 *
 *   idle     → no edits yet this session (no pill shown — calmer first
 *              paint)
 *   saving   → PUT/POST is in flight (animated dot)
 *   saved    → last network call succeeded (with a relative timestamp)
 *   offline  → last network call failed; the next edit retries
 *              automatically. We deliberately don't surface a retry
 *              button — the autosave already covers it.
 *
 * If a contributor disables the backend (e.g., running frontend-only), the
 * hook stays in 'idle' indefinitely and this component renders nothing.
 * That's intentional — silence is the right cue when the feature is off.
 */
import { useBackendAutosave } from '../../hooks/useBackendAutosave';

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString();
}

export function AutosaveIndicator(): React.JSX.Element | null {
  const { status, lastSavedAt, hasEverSaved } = useBackendAutosave();

  if (status === 'idle' && !hasEverSaved) return null;

  const tone =
    status === 'saving'
      ? 'bg-accent-soft text-ink'
      : status === 'offline'
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-surface-2 text-ink-muted';
  const dot =
    status === 'saving'
      ? 'animate-pulse bg-accent'
      : status === 'offline'
        ? 'bg-amber-400'
        : 'bg-emerald-400';

  let label: string;
  if (status === 'saving') label = 'Saving…';
  else if (status === 'offline') label = 'Offline — will retry';
  else if (lastSavedAt) label = `Saved · ${formatRelative(lastSavedAt)}`;
  else label = 'Saved';

  return (
    <span
      role="status"
      aria-live="polite"
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        tone,
      ].join(' ')}
    >
      <span aria-hidden="true" className={['h-1.5 w-1.5 rounded-full', dot].join(' ')} />
      {label}
    </span>
  );
}
