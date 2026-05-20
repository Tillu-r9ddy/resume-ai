/**
 * store/index.ts — assembles the Redux store from three layers of wrapping.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Composition order (READ OUTSIDE-IN — closest to the store first)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   configureStore({ reducer: {
 *     resume: persistReducer( persistConfig,   ← writes to localStorage
 *                  undoable(     resumeReducer, ← past / present / future
 *                       undoableConfig
 *                  )
 *              )
 *   } })
 *
 * Each layer in plain English:
 *   1. resumeReducer    — operates on a plain `Resume`. Knows nothing about
 *                          undo or persistence. Owns the *business logic*.
 *   2. undoable(...)    — wraps the reducer so its output is shaped
 *                          `{ past: Resume[], present: Resume, future: Resume[] }`.
 *                          Every action dispatched is pushed onto `past`; the
 *                          built-in `ActionCreators.undo()` / `.redo()` move
 *                          entries between past/future without re-running
 *                          your reducer.
 *   3. persistReducer   — wraps the above so the state is mirrored to
 *                          localStorage on every change, and restored on
 *                          rehydration. The transform below filters which
 *                          fields actually get persisted.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a transform that drops past/future from the persisted snapshot?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Persisting 50 historical states means localStorage grows to ~50× the size
 *   of your document. Resume documents are small but it adds up — and undo
 *   history across browser sessions is unusual UX. Stick to: persist the
 *   present, start past/future empty on rehydration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why disable `serializableCheck` for the redux-persist actions?
 * ─────────────────────────────────────────────────────────────────────────────
 *   redux-persist dispatches REHYDRATE/PERSIST/etc. with non-serialisable
 *   payloads (Promises, callbacks). RTK's default serializableCheck middleware
 *   would warn on every one. We whitelist them rather than disable the check
 *   entirely — that way we still catch our OWN reducers accidentally storing
 *   Dates/Maps/Sets/etc.
 */
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import undoable from 'redux-undo';
import {
  persistReducer,
  persistStore,
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import { resumeReducer } from './resumeSlice';

/**
 * localStorage adapter for redux-persist.
 *
 * Why a hand-rolled adapter instead of `redux-persist/lib/storage`?
 *   That subpath ships as CommonJS with a fragile default-export shape. Vite
 *   (and other ESM bundlers) sometimes resolve `import storage from ...` to
 *   the module namespace instead of the actual storage object — the symptom
 *   is `storage.getItem is not a function` at runtime. Writing the 6-line
 *   adapter ourselves is more reliable AND makes the Storage interface obvious.
 *
 * The interface redux-persist expects: { getItem, setItem, removeItem } where
 * each method returns a Promise. localStorage is synchronous, so we wrap each
 * call in Promise.resolve(...) — that's exactly what the library's own
 * adapter does internally.
 */
const storage = {
  getItem: (key: string): Promise<string | null> => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

/**
 * UNDOABLE LAYER
 *   - `limit: 50`  → cap memory. The 51st action drops the oldest past entry.
 *   - `syncFilter: true` → when actions arrive in burst (e.g. autosave), still
 *     register each as a separate history entry (we want every change undoable).
 *   - `neverSkipReducer: true` → ensures the wrapped reducer runs on EVERY
 *     action even ones redux-undo wouldn't normally pass through (init/rehydrate).
 *     Critical for redux-persist's REHYDRATE action.
 */
const undoableResume = undoable(resumeReducer, {
  limit: 50,
  syncFilter: true,
  neverSkipReducer: true,
});

/**
 * Persist ONLY the `present` sub-key of the undoable state.
 *
 * Why `whitelist` and not a custom transform?
 *   redux-persist's whitelist filters which TOP-LEVEL KEYS of the slice's
 *   state get written to storage. The undoable wrapper produces a state
 *   shaped { past, present, future, _latestUnfiltered, group, index, limit }.
 *   Listing `['present']` here means only that key is serialised — past/
 *   future restart empty on every browser session, which is the UX we want
 *   for a document editor (cross-session undo is unusual and storage-hungry).
 *
 * Earlier this file used createTransform with `whitelist: ['resume']` for
 * the same purpose, but that was a misuse of the API: transform's whitelist
 * filters sub-key names within the persisted state, and 'resume' isn't a
 * sub-key of { past, present, future } — so the transform was silently
 * skipped and past/future got persisted anyway. The slice-level whitelist
 * below is both shorter and actually correct.
 */
const persistConfig = {
  key: 'resume-ai:resume',
  version: 1,
  storage,
  whitelist: ['present'],
};

const persistedResume = persistReducer(persistConfig, undoableResume);

const rootReducer = combineReducers({
  resume: persistedResume,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        // redux-persist internals dispatch non-serialisable payloads.
        // Listed individually (not disabled wholesale) so our own reducers
        // are still checked.
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  // Devtools enabled in dev only — disabling in prod avoids leaking action
  // payloads to the extension and shaves a tiny bit of bundle.
  devTools: import.meta.env.DEV,
});

/**
 * `persistor` controls rehydration. Pass to <PersistGate> in main.tsx so the
 * app waits for localStorage read-out before rendering — prevents a flash of
 * seed content over what the user actually had.
 */
export const persistor = persistStore(store);

// ── Public types ────────────────────────────────────────────────────────────
// Components don't import these directly; they use the typed hooks in hooks.ts.
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
