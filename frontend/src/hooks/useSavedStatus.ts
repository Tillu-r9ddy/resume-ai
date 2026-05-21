/**
 * useSavedStatus — derives a Saving/Saved status from store-change activity.
 *
 * Approach: subscribe to `past.length + future.length` from the resume's
 * undoable wrapper. Any dispatch changes one of these counts; an undo flips
 * one entry between past and future without changing the sum, so we also
 * include `present` identity to catch that case.
 *
 * On any change, flash to 'saving' for `idleMs`, then settle to 'saved'.
 * The actual persistence is sync-ish (localStorage via redux-persist), so
 * "saving" is a perceptual cue, not a real loading state. That's fine — in
 * Phase 6 when the backend lands we'll wire this to real network status.
 *
 * Why not derive from redux-persist's `persistor.subscribe`?
 *   That fires on bootstrap and on certain whole-store events, but not on
 *   every individual change. Action-count proxy is more reliable for this
 *   "did the user just edit something?" indicator.
 */
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../store/hooks';

export type SaveStatus = 'saved' | 'saving';

export function useSavedStatus(idleMs: number = 600): SaveStatus {
  // Action-count proxy: every dispatch grows past (or clears future), and
  // any reset/replace changes present's identity. Summing past+future
  // catches almost everything; tracking `present` covers replace flows.
  const activity = useAppSelector((s) => s.resume.past.length + s.resume.future.length);
  const present = useAppSelector((s) => s.resume.present);

  const [status, setStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<number | null>(null);
  // Skip the first effect run so the indicator starts as 'saved', not
  // 'saving' (the initial mount isn't really an edit).
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    setStatus('saving');
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setStatus('saved');
      timerRef.current = null;
    }, idleMs);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activity, present, idleMs]);

  return status;
}
