# Phase 3a — Zustand for Global UI State

> Goal: introduce the first piece of the state-management tour. Build a real feature (collapsible sidebar + theme toggle, both persisted) using Zustand, with idioms that scale to the rest of the app.

## What we set up and WHY each piece exists

### 1. One store, two slices: `useUiStore`

- `src/stores/useUiStore.ts` holds `sidebarCollapsed` and `theme` plus an `actions` object.
- **Why a single store?** Zustand favours a small number of stores (often one) over Redux-style "many slices in one root". Each `create()` call mounts a fresh subscription tree; multiple stores fragment your devtools timeline and force consumers to remember which hook to call.
- **Why `actions` nested in a single sub-object?** Zustand v5 dropped automatic shallow comparison for selectors. Returning a fresh `{ a, b }` from a selector triggers a re-render every state change because the new object never `===`s the old. Keeping actions in a stable sub-object means `useUiStore((s) => s.actions)` is a cheap, no-equality-function subscription.

### 2. Middleware: `devtools(persist(...))`

- `persist` writes the state to `localStorage` so theme and sidebar preferences survive reload.
  - `partialize` is critical — it filters which fields persist (excludes the `actions` object; functions aren't serialisable).
  - `version: 1` lets us bump and migrate when the persisted shape changes.
- `devtools` exposes the store to the Redux DevTools browser extension. Action names like `'ui/toggleSidebar'` show up in the timeline — invaluable for debugging "why did state change?".
- **Outside-in order** (`devtools(persist(...))`): the devtools wrapper sees the _post-persist_ state, which is what subscribers see. Reversed order shows pre-hydration state and confuses you.

### 3. Selector-hook pattern

- `useSidebarCollapsed`, `useTheme`, `useUiActions` — one hook per slice you'd want to read.
- **Why?** Each component subscribes only to the slice it actually needs. If only `Shell` reads `sidebarCollapsed`, a `setTheme` action causes zero re-renders elsewhere.
- The thin-hook layer codifies the right pattern at the call site so future devs can't accidentally write `const store = useUiStore()` and re-render on every action.

### 4. Theme bridge: `ThemeManager` + `[data-theme="light"]` overrides

- `components/ThemeManager.tsx` is a render-`null` component that owns ONE effect: set `<html data-theme="...">` and `<html style="color-scheme: ...">` whenever the store's `theme` slice changes.
- `src/index.css` defines all `--color-*` tokens under `@theme` (dark default) plus an override block under `[data-theme="light"]`. Tailwind v4's utilities reference those tokens via `var(...)`, so flipping the attribute swaps every color in the tree with zero React re-render.
- **Why this and not Tailwind's `dark:` variants?**
  - One set of utility names — no `dark:bg-x dark:text-y` noise per element.
  - Adding a third theme (high-contrast, sepia) is a new selector block, not a new variant.
  - Non-Tailwind CSS (component libraries) also reacts to the swap.

### 5. Shell wiring

- `Shell.tsx` reads via the thin selector hooks. Sidebar width swaps between `16rem` (expanded) and `3.5rem` (collapsed rail).
- Collapse and theme buttons sit at the bottom of the sidebar. `aria-pressed`/`aria-label` on each so the controls are accessible.
- `transition-[grid-template-columns]` on the grid container animates the layout shift without animating every other property in the app.

## Phase 3a acceptance criteria

- ✅ Sidebar collapses to a rail and back when you click `«` / `»`.
- ✅ Theme toggles between dark and light when you click the sun/moon button — colors animate, not pop.
- ✅ Both states survive a full page reload (`localStorage` persistence verified).
- ✅ Redux DevTools (browser extension) shows `ui/toggleSidebar`, `ui/setTheme`, etc., in its action timeline (dev builds only).
- ✅ React DevTools → Components shows the Shell only re-renders when the slices it subscribes to actually change.
- ✅ `npm run lint`, `npm run typecheck`, `npm run build` all pass.

## Interview questions Phase 3a prepares you to answer

> **Q:** When would you reach for Zustand over Context?
> **A:** Two big reasons. (1) Performance — Context re-renders every consumer on any state change, while Zustand re-renders only components whose selector return value actually changed. (2) Ergonomics — Zustand needs no provider, no `useContext` boilerplate, has built-in persist/devtools/immer middleware, and lets you read state outside React via `useUiStore.getState()`.

> **Q:** When would you reach for Zustand over Redux Toolkit?
> **A:** Zustand wins when the state slice is small, mostly client-only, and you don't need time-travel debugging, normalised entities, or middleware ecosystems like RTK Query. Redux Toolkit wins when you have a complex domain model (entity adapters, undo/redo, large action graphs) or you want one canonical pattern across a 50-engineer team.

> **Q:** Why split actions from state in the store?
> **A:** Zustand v5 selectors use `Object.is` equality. Returning a literal `{ a, b }` from a selector creates a new object every render → spurious re-renders. Nesting actions in a sub-object that's set once at store init makes `useStore((s) => s.actions)` a stable, no-equality-function subscription.

> **Q:** Why does `partialize` matter in `persist`?
> **A:** Two reasons. (1) Functions in state (actions) aren't serialisable — persisting them throws. (2) Transient state (loading flags, error messages) should NOT come back from storage; reloading with `loading: true` would freeze the UI.

> **Q:** Why apply theme via `data-theme` attribute + CSS variables instead of Tailwind's `dark:` variants?
> **A:** Variable overrides cascade through the whole tree on a single attribute change — every utility class (Tailwind or otherwise) reacts. The `dark:` variant approach scales to two themes; tokens-via-attribute scales to N themes and works with non-Tailwind CSS too. Cost is a bit more setup in the CSS file once.

> **Q:** Why mount ThemeManager separately instead of putting the effect in App.tsx?
> **A:** Single-responsibility. App's job is to mount the router. ThemeManager's job is to bridge store-to-DOM. Splitting them lets the bridge be unmounted/remounted in tests, keeps the App entry tiny, and makes the "theming side-effect" trivial to find by name.

## What's next: Phase 3b (TanStack Query or Redux Toolkit)

Next library, next motivating feature:

- **TanStack Query** if you want to wire the upcoming backend chat/templates fetch story first. Fits with Phase 6's SSE/REST work.
- **Redux Toolkit** if you want to model the resume document domain (sections, items, undo/redo) before the Phase 4 editor.

Either is a good next step; the order depends on which feature you want to build first.
