# Phase 4a — Resume Document Store (RTK + Undo + Persist)

> Goal: land the resume document's data model and state layer. No real form UI yet — that's 4b. This pass owns the schema, the slice, undo/redo, and persistence, plus a debug panel proving every piece works.
>
> This phase doubles as the **Phase 3b** deep dive — Redux Toolkit's slot in the state-management tour.

## What we set up and WHY each piece exists

### 1. Zod schema (`src/schema/resume.ts`) — the document contract

- A **discriminated union** over `Section.type` (`header | experience | education | skills | projects`). TS narrows on `section.type` automatically; Zod's `z.discriminatedUnion` gives precise error messages like `experience.items[0].company required`.
- `Header` is a **singleton** section (has `data`, not `items`). Repeating sections own an `items` array.
- `YearMonth` = `'YYYY-MM'` regex-validated string. Plain strings survive JSON round-trips (Date objects don't), and resumes rarely need day-precision.
- `end: YearMonth | null` — `null` is the canonical sentinel for "Present". Avoids a magic `'present'` string that needs locale handling.
- IDs come from `crypto.randomUUID()` (`newId()`). Stable identity is required for keyed reorders and for React `key` props once dnd-kit lands in 4d.

### 2. RTK slice (`src/store/resumeSlice.ts`) — the reducer + actions

- `createSlice` autogenerates the reducer, action creators, and action type strings from one declaration. ~5× less boilerplate than the hand-rolled `createReducer + createAction` pair.
- All reducers use **Immer** mutation syntax (`state.sections.push(...)`) — RTK pipes everything through Immer so a mutation actually produces a new immutable state. Avoids the spread-the-path-back-up problem.
- Reducers shipped in 4a: `setResume`, `updateHeader`, `addSection`, `removeSection`, `removeLastSection`, `resetResume`. Enough for the debug panel to exercise add/remove/reset flows. 4b/4c/4d will extend (per-item add/remove, reorder, etc.).
- `resetResume` returns a fresh seed — when an Immer reducer **returns** a value, that value replaces the draft entirely. Useful for "load this whole document" actions.

### 3. Factory helpers (`src/store/seedResume.ts`)

- One central place that owns "what does an empty `ExperienceItem` look like?". When the schema gets a new required field, you change the factory, not 12 reducers.
- `makeSection(type)` is a switch with an `_exhaustive: never` default — adding a new `SectionType` without updating the switch becomes a TypeScript error. Cheap insurance.
- `seedResume()` returns Ada Lovelace's resume so the debug panel has believable content on a fresh install.

### 4. Store composition (`src/store/index.ts`) — three wrapped layers

```
persistReducer(undoable(resumeReducer))
   └ outer        └ middle    └ inner
```

- **Inner** — `resumeReducer` operates on a plain `Resume`. Knows nothing about undo or persistence. Single responsibility: business logic.
- **Middle** — `undoable(...)` from `redux-undo` wraps it. Output shape becomes `{ past: Resume[], present: Resume, future: Resume[] }`. `limit: 50` caps history (memory). `neverSkipReducer: true` is critical so redux-persist's `REHYDRATE` action still reaches the inner reducer.
- **Outer** — `persistReducer(...)` mirrors state to `localStorage` on every dispatch and restores it on rehydration. The persist config passes `whitelist: ['present']`, which is the slice-level allowlist of top-level keys to persist. Result: only `present` round-trips through storage; `past`/`future` restart empty on every browser session. Undo history across sessions is unusual UX and the storage savings are real.
  - **Footnote / lesson learned:** an earlier draft used `createTransform(..., { whitelist: ['resume'] })` for the same purpose. That was a misuse of the transform API — transform's `whitelist` filters by _sub-key name_ within the state, and `'resume'` isn't a sub-key of `{past, present, future}`, so the transform was silently skipped and the whole undoable shape got persisted anyway. The slice-level `whitelist: ['present']` on persistConfig is both shorter and actually correct.

### 5. Serializability check whitelist

- redux-persist dispatches `FLUSH | REHYDRATE | PAUSE | PERSIST | PURGE | REGISTER` with non-serialisable payloads (Promises, callbacks). RTK's `serializableCheck` middleware would warn on every one.
- We **whitelist** those action types instead of disabling the check wholesale — that way the middleware still catches _our_ reducers accidentally storing a `Date` / `Map` / `Set`.

### 6. Typed hooks (`src/store/hooks.ts`)

- `useAppDispatch` / `useAppSelector` pre-bound to `AppDispatch` / `RootState` via react-redux v9's `withTypes<>`.
- Forces every call site to inherit types automatically — no per-component generics. The whole codebase imports these, never the raw `useDispatch`/`useSelector`.

### 7. `<Provider>` + `<PersistGate>` (`src/main.tsx`)

- `Provider` gives the tree access to the store.
- `PersistGate` **blocks render until localStorage rehydrates**. Without it, the user sees seed content for a frame, then their actual saved resume swaps in — visually jarring, and would break RHF's `defaultValues` in 4b.
- `loading={null}` is fine for warm-cache localStorage. Phase 9 can swap in a branded splash if we ever need cold-cache UX.

### 8. Debug panel (`src/routes/Editor.tsx`)

- Action buttons for each non-header section type (Header is a singleton, omitted).
- Undo/Redo backed by `ActionCreators.undo()` / `.redo()` from redux-undo. Disabled when `past.length === 0` / `future.length === 0`.
- Live JSON view of `state.resume.present` with a footer showing `past`/`future` counts.
- Phase 2's "crash this route" button stays — proves the error boundary still catches inside the newly Provider-wrapped tree.

## Phase 4a acceptance criteria

- ✅ `/editor` shows the seed resume's JSON, plus add/remove/reset buttons.
- ✅ Clicking "+ Add experience" mutates the document; the JSON view updates immediately.
- ✅ Reload the page — your changes persist (localStorage key `resume-ai:resume`).
- ✅ Undo walks back every action in order. Redo restores them.
- ✅ Redux DevTools (browser extension) shows `resume/addSection`, `@@redux-undo/UNDO`, etc., in its timeline.
- ✅ `npm run lint`, `npm run typecheck`, `npm run build` all pass.
- ✅ "Crash this route" still triggers the Phase 2 error boundary.

## Interview questions Phase 4a prepares you to answer

> **Q:** Why pick Redux Toolkit for this slice when the UI store uses Zustand?
> **A:** Different problems, different tools. Resume edits need undo/redo (redux-undo plugs into Redux's reducer-wrapping API; no equivalent for Zustand without rolling your own), a named action log for debugging, and a path to normalised entities (createEntityAdapter) as the doc grows. UI flags (sidebar, theme) are tiny client-only state — Zustand's smaller API wins there. Mixing libraries is fine when each is chosen for the right reason.

> **Q:** How do you compose redux-undo and redux-persist?
> **A:** Outside-in: `persistReducer(persistConfig, undoable(reducer, undoableConfig))`. The undoable wrapper produces `{past, present, future}`; persistReducer mirrors that to storage. Pair it with `neverSkipReducer: true` on the undoable config so redux-persist's `REHYDRATE` action still flows through to the inner reducer.

> **Q:** Why persist only `present` and not the whole undoable state?
> **A:** Without filtering, every undo history entry (up to 50 copies of the document) gets serialised on every change — localStorage bloats and writes get slow. Pass `whitelist: ['present']` on the persistConfig so only that top-level key of the undoable state gets written; past/future restart empty on every browser session. Trade-off: undo history doesn't survive a reload. That's the right call for a doc editor; if you needed cross-session undo, you'd drop the whitelist. **Gotcha:** don't reach for `createTransform` here — that API's `whitelist` filters by sub-key name within the per-key value, not by top-level state key, and it's easy to misuse such that the transform silently no-ops.

> **Q:** Why disable the serializability check for redux-persist actions?
> **A:** redux-persist dispatches actions with non-serialisable payloads (Promises). RTK's default middleware warns on every one. You whitelist those specific action types instead of turning the check off entirely — that way your own reducers still get policed.

> **Q:** Why a discriminated union over a polymorphic Section?
> **A:** TypeScript narrows on the literal `type` field automatically, so `if (section.type === 'experience') section.items` is fully typed with no cast. Zod's `z.discriminatedUnion` also produces field-precise validation errors instead of a generic "Section invalid". And adding a new section type forces every consumer's switch to handle it — caught at compile time.

> **Q:** Why does PersistGate matter — couldn't you just render and let things hydrate?
> **A:** Without PersistGate, the store starts with `initialState` (the seed), renders one frame with that, then swaps in the rehydrated state. Users see a flash of seed content, and any code reading state during mount (defaultValues for forms, initial layout calculations) will lock onto the wrong values. PersistGate blocks the first render until rehydration completes.

> **Q:** When would you reach for createEntityAdapter?
> **A:** When you have a flat collection of objects that you look up by ID frequently (the items in a section), need O(1) updates, and want pre-built memoised selectors. We didn't use it in 4a because the document is naturally nested (sections → items) and small. If the editor grows to thousands of items, we'd flatten items into `{ entities, ids }` shapes per section.

## What's next: Phase 4b

- React Hook Form per-section (one form per section, not one giant form).
- `zodResolver` from `@hookform/resolvers` wires the existing Zod schemas to RHF validation — schema is the single source of truth for both shape AND validation rules.
- Build the **Header** section first (singleton, simplest case) and a live preview pane on the right.
- The controlled-vs-uncontrolled lesson lives here — RHF is uncontrolled-first, which is why it scales to 100s of fields without re-renders.
