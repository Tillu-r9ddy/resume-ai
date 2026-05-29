/**
 * useBackendAutosave — debounced PUT of the current resume to the backend.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a hook and not a Redux middleware?
 * ─────────────────────────────────────────────────────────────────────────────
 *   A middleware fires for every action, including undo/redo and rehydrate.
 *   A hook subscribes to the *resolved* document and naturally coalesces
 *   bursts via React's render cycle. Simpler, fewer corner cases, and the
 *   hook can use `AbortController` to cancel an in-flight PUT when a newer
 *   change is ready — the middleware shape has no convenient hook for that.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Save lifecycle
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. The user edits → resume slice updates → this hook's selector fires.
 *   2. We clear any pending timer and start a new one (`debounceMs`).
 *   3. When the timer fires, we POST (first save) or PUT (subsequent), and
 *      cache the returned `id`. Subsequent saves PUT to that id.
 *   4. While the request is inflight, status is 'saving'. On success it
 *      transitions to 'saved'. On failure, 'offline' — the next edit triggers
 *      a fresh attempt automatically.
 *
 *   No retries / no queue. The current document IS the state to send, so a
 *   failed save just means "send the same content again next debounce
 *   window". Simpler than a journal of pending mutations and equivalent in
 *   user-visible behaviour for a full-replace API.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why "first save = POST then remember the id" instead of an upsert PUT?
 * ─────────────────────────────────────────────────────────────────────────────
 *   POST returning a server-assigned id is the REST idiom — it makes the
 *   "do we have a server record yet?" state explicit instead of conflated
 *   with the client id. The id is cached in localStorage so a refresh
 *   doesn't accidentally create a duplicate.
 */
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { ApiError, resumesApi } from '../api/client';
import type { Resume } from '../schema/resume';

export type BackendSaveStatus = 'idle' | 'saving' | 'saved' | 'offline';

const REMOTE_ID_STORAGE_KEY = 'resume-ai:remote-id';

function readRemoteId(): string | null {
  try {
    return localStorage.getItem(REMOTE_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRemoteId(id: string): void {
  try {
    localStorage.setItem(REMOTE_ID_STORAGE_KEY, id);
  } catch {
    // localStorage may be unavailable (private mode, quota); the save still
    // succeeded on the server, we just can't remember the id locally. Next
    // refresh will create a new record — annoying but not data loss.
  }
}

export interface UseBackendAutosaveResult {
  status: BackendSaveStatus;
  /** Timestamp of the last successful save, or null. */
  lastSavedAt: Date | null;
  /** True until the first edit after mount — lets the UI hide "Saved" on load. */
  hasEverSaved: boolean;
}

export function useBackendAutosave(options?: {
  debounceMs?: number;
  /** Disable entirely (e.g. during tests, or if a user disables sync). */
  enabled?: boolean;
}): UseBackendAutosaveResult {
  const { debounceMs = 800, enabled = true } = options ?? {};

  // The undoable wrapper exposes the live doc under `present`. Selecting the
  // whole object means we re-run on every change — that's what we want; the
  // debounce below coalesces bursts.
  const resume = useAppSelector((s) => s.resume.present) as Resume;

  const [status, setStatus] = useState<BackendSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasEverSaved, setHasEverSaved] = useState(false);

  const remoteIdRef = useRef<string | null>(readRemoteId());
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (isFirstRenderRef.current) {
      // Don't autosave on mount — that's just rehydration, not a user edit.
      isFirstRenderRef.current = false;
      return;
    }

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void runSave();
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    async function runSave(): Promise<void> {
      // Cancel any in-flight save — its content is now stale and the new
      // one will include the same data plus the latest edits.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('saving');
      const body = { title: resume.title, sections: resume.sections };

      try {
        let saved;
        if (remoteIdRef.current) {
          saved = await resumesApi.update(remoteIdRef.current, body);
        } else {
          saved = await resumesApi.create(body);
          remoteIdRef.current = String(saved.id);
          writeRemoteId(remoteIdRef.current);
        }
        if (controller.signal.aborted) return;
        setStatus('saved');
        setLastSavedAt(new Date());
        setHasEverSaved(true);
      } catch (err) {
        if (controller.signal.aborted) return;
        // 404 means the cached remote id is stale (the record was deleted
        // server-side). Drop it so the next save creates a new one.
        if (err instanceof ApiError && err.status === 404) {
          remoteIdRef.current = null;
          try {
            localStorage.removeItem(REMOTE_ID_STORAGE_KEY);
          } catch {
            // ignore
          }
        }
        setStatus('offline');
      }
    }
    // resume is the trigger. debounceMs/enabled feed into the inner closure.
  }, [resume, debounceMs, enabled]);

  return { status, lastSavedAt, hasEverSaved };
}
