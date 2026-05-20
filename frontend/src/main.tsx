/**
 * Application entry point.
 *
 * This file's ONLY job is to mount the React tree into the DOM. Keep it tiny.
 * Don't add business logic here — anything app-wide goes inside <App /> so it's
 * exercised by tests, Storybook, etc. (those don't run this file).
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import App from './App';
import { store, persistor } from './store';
import './index.css';

/**
 * `document.getElementById('root')` returns `HTMLElement | null`. The non-null
 * assertion `!` tells TS "trust me, it exists" — safe here because the element
 * is hard-coded in index.html.
 *
 * Better practice (which we'll adopt in Phase 5 when we add error handling):
 *   const container = document.getElementById('root');
 *   if (!container) throw new Error('Root element missing from index.html');
 *
 * Why? `!` silently produces `Cannot read properties of null` at runtime if the
 * element is ever removed. An explicit throw gives a clear, debuggable error.
 */
const rootElement = document.getElementById('root')!;

/**
 * `createRoot` is the React 18+ API for "concurrent rendering". Replaced the old
 * `ReactDOM.render` from React 17. Unlocks:
 *   • Automatic batching of state updates (fewer re-renders)
 *   • useTransition / useDeferredValue (mark updates as low-priority)
 *   • Suspense for data fetching
 *
 * Interview Q: "What's the difference between createRoot and ReactDOM.render?"
 *   Concurrent mode. Old API is legacy/blocking; new API is interruptible.
 */
const root = createRoot(rootElement);

root.render(
  /**
   * <StrictMode> is a DEV-ONLY wrapper that helps catch bugs by:
   *   1. Double-invoking your render functions, effects, and reducers — exposes
   *      side effects accidentally written in render (a top React bug source).
   *   2. Warning about deprecated APIs and unsafe lifecycle methods.
   *   3. Detecting unexpected side effects in React 19's new Compiler.
   *
   * Production build STRIPS this out → zero perf cost in prod.
   * NEVER remove this to silence double-renders; fix the offending effect instead.
   */
  /**
   * Provider + PersistGate — composition order matters:
   *
   *   <Provider>           ← gives the whole tree access to the Redux store
   *     <PersistGate>      ← blocks render until localStorage is rehydrated
   *       <App />          ← sees the *restored* state from its first render
   *
   * Why PersistGate instead of "render immediately"?
   *   Without it, the user sees the seed resume for a frame, then their saved
   *   resume swaps in — visually jarring, and any RHF default-values logic in
   *   Phase 4b would lock onto the wrong values.
   *
   * `loading={null}` is fine here — localStorage reads are sync-ish and
   * complete before the first paint on a warm cache. Phase 9 can swap in a
   * branded splash screen if we ever go cold-cache.
   */
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  </StrictMode>,
);
