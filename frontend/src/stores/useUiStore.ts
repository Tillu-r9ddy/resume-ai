/**
 * useUiStore — global *UI* state via Zustand.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY Zustand for this slice (and not Context, Redux, Jotai, TanStack Query)?
 * ─────────────────────────────────────────────────────────────────────────────
 *   This slice is:
 *     1. Truly global  — read from Shell, the eventual command palette, modals,
 *        keyboard shortcut handlers, etc.
 *     2. Tiny           — two pieces of state today, maybe ten ever.
 *     3. Client-only    — no server round-trips, no caching concerns.
 *     4. Long-lived     — must persist between sessions (theme, sidebar pref).
 *
 *   Decision matrix:
 *     • Context        → re-renders EVERY consumer on any state change. Fine
 *                        for "set-once" config (locale, current user). Painful
 *                        for chatty UI state like collapsed/expanded toggles.
 *     • Redux Toolkit  → great when you need time-travel debugging, undo/redo,
 *                        normalised entities, or middleware (RTK Query). Overkill
 *                        for "is the sidebar open?".
 *     • Jotai          → atomic state shines when MANY tiny pieces of state
 *                        update independently (think: hundreds of form fields).
 *                        Two-field UI store doesn't earn the atom overhead.
 *     • TanStack Query → server cache. Wrong tool — this isn't server state.
 *     • Zustand        → tiny API, no provider, built-in persist + devtools
 *                        middleware, perfect for "global-ish UI flags". This is
 *                        EXACTLY the problem it was designed for.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Read this code in order:
 *   1. The state shape interface     (`UiState`)
 *   2. The store creation            (`create<UiState>()(...)`)
 *   3. The selector hooks at the bottom — those are what components consume.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface UiActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

interface UiState {
  /** Whether the Shell's sidebar is collapsed (rail) or expanded (full). */
  sidebarCollapsed: boolean;
  /** Active color theme. Mapped to `<html data-theme="...">` by ThemeManager. */
  theme: Theme;
  /**
   * Actions live inside a single nested object so its identity stays stable
   * across renders. That makes the "select all actions at once" hook below a
   * cheap, no-equality-function subscription.
   *
   * Why nest instead of leaving actions at the top level? Top-level fields
   * make `useUiStore((s) => s)` tempting and that subscribes to *everything*.
   * Splitting state from actions teaches the call site to pick one or the
   * other — never both via a single selector.
   */
  actions: UiActions;
}

/**
 * `devtools(persist(...))` — middleware composition reads OUTSIDE-IN:
 *   1. devtools wraps persist
 *   2. persist wraps the raw store
 *   So state changes flow: action → persist (writes localStorage) → devtools
 *   (broadcasts to Redux DevTools extension) → subscribers re-render.
 *
 * WHY this ordering and not the other way around?
 *   If devtools were the innermost middleware, you'd see the *unpersisted*
 *   state in the devtools panel — confusing during hydration. Outermost
 *   devtools shows you exactly what subscribers see.
 */
export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        // ── Initial state ─────────────────────────────────────────────────
        sidebarCollapsed: false,
        theme: 'dark',

        // ── Actions ────────────────────────────────────────────────────────
        // `set` accepts either a partial object (shallow-merged) OR a function
        // that returns one. Use the function form whenever the next state
        // depends on the current state — same rule as React's setState.
        actions: {
          toggleSidebar: () =>
            set(
              (s) => ({ sidebarCollapsed: !s.sidebarCollapsed }),
              false,
              'ui/toggleSidebar', // devtools action name — shows up in the timeline
            ),
          setSidebarCollapsed: (collapsed) =>
            set({ sidebarCollapsed: collapsed }, false, 'ui/setSidebarCollapsed'),
          setTheme: (theme) => set({ theme }, false, 'ui/setTheme'),
          toggleTheme: () =>
            set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' }), false, 'ui/toggleTheme'),
        },
      }),
      {
        // localStorage key — bump the version when you make a breaking change
        // to the persisted shape (e.g. rename `theme` to `colorScheme`).
        name: 'resume-ai:ui',
        version: 1,
        storage: createJSONStorage(() => localStorage),
        /**
         * `partialize` filters WHICH parts of state get written to storage.
         * Critical for two reasons:
         *   1. Don't persist actions — they're functions, not serialisable.
         *   2. Don't persist transient state (loading flags, errors). Reloading
         *      with a stale "loading: true" would freeze the UI.
         */
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          theme: state.theme,
        }),
      },
    ),
    { name: 'ui-store', enabled: import.meta.env.DEV },
  ),
);

/* ────────────────────────────────────────────────────────────────────────────
 * SELECTOR HOOKS — the recommended consumption pattern.
 * ──────────────────────────────────────────────────────────────────────────
 * Without a selector:
 *     const store = useUiStore();              // re-renders on ANY state change
 *     <div>{store.theme}</div>
 * With a selector:
 *     const theme = useUiStore((s) => s.theme); // re-renders ONLY when theme changes
 *
 * Zustand uses Object.is for selector equality by default — primitives just
 * work. For composite returns from a selector, either use Zustand's `useShallow`
 * OR (as we do here) return a value whose identity is already stable.
 *
 * These thin hooks codify the right pattern at the call site so you can't
 * accidentally subscribe to the whole store from inside a component.
 * ────────────────────────────────────────────────────────────────────────── */

export const useSidebarCollapsed = (): boolean => useUiStore((s) => s.sidebarCollapsed);

export const useTheme = (): Theme => useUiStore((s) => s.theme);

/**
 * Stable identity — `actions` is set once at store init and never reassigned,
 * so subscribers don't re-render on unrelated state changes.
 */
export const useUiActions = (): UiActions => useUiStore((s) => s.actions);
