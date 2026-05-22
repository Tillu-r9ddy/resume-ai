# Phase 5 — Performance (measure first)

> Goal: a real before/after on the editor's render cost and the initial-load bundle, not "we sprinkled memo everywhere." Phase 4d shipped a feature-complete editor; Phase 5 makes it fast enough to feel boring and keeps the non-editor routes light.

## The rule: measure first

The cardinal Phase 5 mistake is to read the code, guess what's slow, and reach for `React.memo` / `useMemo` everywhere. You end up with worse code (extra indirection, dependency arrays to bug-rot, harder to refactor) and no proof anything got faster. So before touching any component, this phase added two pieces of instrumentation and one benchmark fixture.

### 1. Bundle visualizer

`rollup-plugin-visualizer` wired into `vite.config.ts` behind an `ANALYZE=1` env gate. Off by default — normal builds stay fast. Run `ANALYZE=1 npm run build -w frontend` and open `frontend/dist/stats.html` for a treemap with raw / gzip / brotli sizes per module.

```ts
// vite.config.ts
const ANALYZE = process.env.ANALYZE === '1';
plugins: [
  react(),
  tailwindcss(),
  ...(ANALYZE ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, open: true })] : []),
],
```

### 2. Dev-only render profiler

`components/dev/RenderProfiler.tsx` wraps React's built-in `<Profiler>` API and accumulates one row per `id` on `window.__perf`. In production it's a passthrough (no Profiler wrapper, no globals) because `import.meta.env.DEV` short-circuits the import branch.

Usage from the browser console:

```js
__perf.reset(); // zero counters
// …type one character into an Experience field…
__perf.snapshot();
// console.table:
// ┌─────────────┬─────────┬───────┐
// │   (index)   │ commits │  ms   │
// ├─────────────┼─────────┼───────┤
// │ FormPane    │    1    │ 12.3  │
// │ PreviewPane │    1    │  0.9  │
// └─────────────┴─────────┴───────┘
```

Two probes wrap `EditorLayout`'s form pane and preview pane respectively. Adding more is one line per probe.

Why this and not just React DevTools Profiler? DevTools is the right deep-dive tool. The sidecar is for the "type 10 characters, read one number" loop — it's lower friction and the readout is reproducible across browsers without DevTools installed.

### 3. Benchmark resume

`store/benchmarkResume.ts` produces a deliberately large document:

| Section    | Items                          |
| ---------- | ------------------------------ |
| Header     | 1 (with 3 links)               |
| Experience | 15 jobs (3–5 bullets each)     |
| Education  | 6 entries                      |
| Skills     | 8 groups (3–5 skills each)     |
| Projects   | 10 projects (2–3 bullets each) |

Loaded via the "⚡ Load benchmark" button in the dev panel (gated on `import.meta.env.DEV` so it tree-shakes out of prod). At this scale every unnecessary re-render shows up in `__perf.ms` clearly; the seed resume is too small to surface real cost.

## What we changed (and why)

### A. Preview memoization — `React.memo` on every preview component

The smoking gun, confirmed by reading the code:

1. `selectSections` returns `state.resume.present.sections`.
2. Immer rebuilds every ancestor path of a changed node, so `sections` gets a new array reference on every keystroke that hits any item.
3. `Preview` re-renders → maps over sections → every per-type preview renders again, even sections that didn't change.

But Immer's structural sharing also guarantees the opposite: branches that _didn't_ change keep their old references. So if you edit `items[0].title` in an Experience section, the Skills section's `items` array reference is byte-for-byte the same as before. Wrap each preview in `React.memo` and the default shallow equality check skips that subtree.

```ts
// before
export function HeaderPreview({ header }: Props) { ... }

// after
function HeaderPreviewInner({ header }: Props) { ... }
export const HeaderPreview = memo(HeaderPreviewInner);
```

Five files, identical pattern: `HeaderPreview`, `ExperiencePreview`, `EducationPreview`, `SkillsPreview`, `ProjectsPreview`. Each is a leaf in the preview tree, so memoizing them is the highest-leverage spot — the parent `Preview` still re-renders (it must, the array reference changed), but the actual DOM work happens only in the one section that changed.

### B. Vendor chunk split — `manualChunks` in `rollupOptions.output`

Default Vite chunking puts every `node_modules/*` import into one `vendor` chunk. With route-level lazy splitting (Phase 2) the Editor route gets its own chunk, but vendor is still loaded upfront on every route — including dnd-kit and react-hook-form, which are editor-only.

Phase 5 splits vendor into five buckets:

| Bucket  | Members                                                         | Why                            |
| ------- | --------------------------------------------------------------- | ------------------------------ |
| `react` | react, react-dom, react-router                                  | Shared by every route          |
| `state` | @reduxjs/toolkit, react-redux, redux, redux-undo, redux-persist | Shared by every route          |
| `forms` | react-hook-form, @hookform/resolvers, zod                       | Editor-only — defer cost       |
| `dnd`   | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities            | Editor-only — defer cost       |
| (rest)  | everything else                                                 | Vite's default `vendor` bucket |

Each bucket is "one logical library family that ships together." Finer-grained splitting (one chunk per package) just deepens the waterfall without helping caching, because the packages in each family always upgrade together.

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('react-hook-form') || id.includes('@hookform')) return 'forms';
  if (id.includes('/zod/') || id.endsWith('/zod')) return 'forms';
  if (id.includes('@dnd-kit')) return 'dnd';
  if (id.includes('@reduxjs/toolkit') || id.includes('react-redux')) return 'state';
  if (id.includes('/redux-undo') || id.includes('/redux-persist') || id.includes('/redux/')) return 'state';
  if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router')) return 'react';
  return undefined;
}
```

## Bundle: before → after

Build output, gzipped sizes:

| Chunk                        | Before    | After    | Change       |
| ---------------------------- | --------- | -------- | ------------ |
| `index` (shell + non-vendor) | 125.12 kB | 7.14 kB  | **−118 kB**  |
| `react`                      | —         | 86.79 kB | (split out)  |
| `state`                      | —         | 13.02 kB | (split out)  |
| `forms`                      | —         | 27.82 kB | (split out)  |
| `dnd`                        | —         | 18.21 kB | (split out)  |
| `Editor`                     | 32.38 kB  | 6.76 kB  | **−25.6 kB** |
| Home / Chat / NotFound       | < 1 kB    | < 1 kB   | unchanged    |
| **Total JS shipped**         | ~158 kB   | ~160 kB  | ≈ same       |

What actually matters is **what each route pays upfront**:

| Route                   | Before (gz) | After (gz) | Δ        |
| ----------------------- | ----------- | ---------- | -------- |
| Home / Chat (first hit) | ~158 kB     | **107 kB** | −32 %    |
| Editor (first hit)      | ~158 kB     | ~160 kB    | flat     |
| Editor after Home/Chat  | n/a         | +53 kB     | warm-nav |

A user landing on Home and never opening the editor saves 51 kB gzipped (~32 %). A user who navigates Home → Editor pays the dnd + forms + Editor chunks (~53 kB gz) on that navigation, with react and state already cached. Net total transferred is the same; perceived initial load is faster.

> Phase 5 deliberately keeps the editor route's first-hit cost unchanged — splitting dnd / forms out of vendor doesn't reduce what Editor needs, it just relocates it. The win is for non-editor traffic and for cache stability across re-deploys (changing `forms` doesn't bust the `react` chunk).

## Render: how to capture the before/after

The infrastructure is in place; running the measurement is a 30-second loop in the browser. Procedure:

1. `npm run dev` and open `/editor`.
2. Open dev panel → click **⚡ Load benchmark**.
3. Open devtools console. Run `__perf.reset()`.
4. Click into the first Experience item's title field, type one character.
5. Run `__perf.snapshot()`.

Expected with the Phase 5 changes:

- `PreviewPane.commits` will still be 1 per keystroke — the parent always re-renders because the sections array reference changed.
- But `PreviewPane.ms` should be a fraction of the pre-memo value, because four of the five sections short-circuit at their `memo()` boundary instead of re-rendering their items.
- `FormPane.commits` will also be 1 per keystroke. We did not touch the form pane in this phase — see "What we deliberately did NOT do" below.

Repeat with the memoization reverted (or on a previous commit) for the before number.

## What we deliberately did NOT do

These showed up while reading the code. We declined them on purpose; flag the reasoning if a future profile shows them as bottlenecks.

- **`React.memo` on `SectionCard` (form pane).** Its props include `bindings` (a fresh object from `useSortable` on every render) and an inline `onRemove` arrow. Shallow equality fails, so the memo would do nothing useful unless we also wrapped both — and `bindings.style` legitimately changes during a drag. Cost > benefit until profiling shows the form pane is actually slow.
- **Virtualization for the Preview.** `react-virtual` etc. are the right answer when item counts hit hundreds. The benchmark resume tops out at 15 jobs. Memo gets us there for the realistic case; virtualization is the right call once a user complains.
- **Web Worker for the eventual PDF generator.** Deferred to Phase 7, where the generator actually mounts. Today's preview is plain HTML — no off-main-thread work to schedule.
- **`useMemo` inside the section forms.** The existing `useMemo(() => ({ items }), [items])` in each section form (Phase 4c) is load-bearing for `useReduxBoundForm` — that's not a perf hack, it's a sync-loop guard. We left it alone. No new `useMemo` was added speculatively.

## Phase 5 acceptance criteria

- ✅ Bundle analyzer wired behind `ANALYZE=1`; `dist/stats.html` emitted on demand.
- ✅ Benchmark resume + dev "Load benchmark" button gated on `import.meta.env.DEV`.
- ✅ `RenderProfiler` with `window.__perf` console helpers; production tree-shakes the Profiler away.
- ✅ All five preview components wrapped in `React.memo`.
- ✅ `manualChunks` split vendor into react / state / forms / dnd buckets.
- ✅ Initial-load gzipped JS for non-editor routes dropped ~32 %.
- ✅ Editor chunk shrank from 32 → 7 kB gz (its vendor deps moved into cacheable shared chunks).
- ✅ Lint + typecheck + build all pass.

## Interview questions Phase 5 prepares you to answer

> **Q:** How do you decide what to memoize in React?
> **A:** Measure first. The profiler API plus the React DevTools Profiler give per-commit timings; `React.memo` is the right answer only when (a) a component re-renders many times when its inputs didn't change and (b) the render work is non-trivial. Memoizing leaf components with stable prop references — like the preview components here, which receive Immer-stabilized subtrees — is high leverage. Memoizing components whose props change every render (because parents pass fresh arrows or objects) does nothing except add an equality check. The default move is no memo; you add it where the profile says so.

> **Q:** Why does `React.memo` on the preview components actually help here?
> **A:** The Preview's parent re-renders on every keystroke because the sections array gets a new reference (Immer rebuilds every ancestor path of a changed node). But Immer's structural sharing keeps unchanged section subtrees pointing at the same object reference as before. So `memo`'s default shallow comparison correctly returns true for sections that didn't change, and React skips the whole subtree. We get the cost of one section's render per keystroke instead of N. The key is that the upstream data layer (Redux + Immer) preserves referential equality — without that, `memo` would be useless because every prop would look new.

> **Q:** Walk me through how you split a vendor chunk.
> **A:** Three steps. First, install a visualizer (`rollup-plugin-visualizer`) and gate it behind an env flag so it doesn't slow normal builds — that gives you a treemap of what's in each chunk by raw / gzip / brotli size. Second, identify _families_ of packages that ship and upgrade together: react+react-dom+react-router, redux+RTK+react-redux. Third, write `manualChunks(id)` that returns a bucket name per family, leaving anything you don't classify in the default vendor chunk. Avoid one-chunk-per-package — that just deepens the network waterfall without helping cache hits. The win you're after is "this route doesn't need that chunk yet" (forms + dnd only ship when Editor loads) and "changing this dep doesn't bust the other chunks' cache."

> **Q:** Why didn't you memoize the section card / form pane?
> **A:** Because its props don't satisfy shallow equality. The card receives `bindings` from `useSortable` (a fresh object every render) and an inline `onRemove` arrow. Wrapping in `memo` without also stabilizing both would do nothing — the equality check would always be false. And `bindings.style` legitimately changes during a drag, so trying to stabilize it would break the drag visual. The phase's rule is "measure first, then optimize" — the form pane didn't show up as hot enough to justify the API contortion. If a future profile changes that, the fix is to lift `bindings` into a context (so memoizable siblings stop seeing it as a prop) or to use `useCallback` for `onRemove` keyed by section id.

> **Q:** What's the trade-off when you split a chunk?
> **A:** You're trading one big network request for two (or more) smaller ones. The wins: smaller initial download for routes that don't need everything, and cache stability when one chunk updates but others don't. The costs: deeper waterfall (HTTP/2 mitigates this) and a slightly larger total transfer because each chunk has its own minification overhead. The right granularity is "one chunk per logical family that ships together." A monolithic vendor chunk over-bundles; a chunk-per-package over-splits.

> **Q:** Why didn't you use virtualization?
> **A:** Because the benchmark resume tops out at 15 jobs and `React.memo` gets the per-keystroke cost down without the API surface area virtualization brings (synthetic scroll containers, fixed-or-measured heights, focus management complications inside virtual rows). `react-virtual` is the right answer once a user has hundreds of items — at that point the DOM size itself becomes a problem. We documented it as a "not yet" rather than adding it speculatively.

> **Q:** How would you measure the impact of these changes?
> **A:** Two measurements, one for bundle, one for runtime. Bundle: `vite build` output for chunk sizes (raw + gzip), plus the `rollup-plugin-visualizer` treemap to confirm we're splitting along the boundaries we intended. Runtime: the in-page `RenderProfiler` wraps the form pane and preview pane and accumulates per-commit time on a window-global; you reset it, simulate the user action (type one character), and read the totals. Compare before/after by reverting the memo changes on a branch and re-running the exact same procedure. The point is to have _numbers_, not "feels faster."

## What's next: Phase 6 — Backend (FastAPI)

Phase 5 leaves the editor fast enough for its current scope. Phase 6 swaps the localStorage-only autosave for real network status:

- FastAPI service with `/api/resumes` CRUD
- Wire the `AutosaveIndicator` to actual request states (in-flight, saved, offline + N pending)
- Optimistic updates with rollback on failure
- Background sync queue for the offline case

The `AutosaveIndicator` doc in Phase 4d already flags itself as a perceptual placeholder. Phase 6 makes it honest.
