# Phase 4b — React Hook Form binding for the Header section

> Goal: turn the Phase 4a debug panel into a real editor. Wire React Hook Form + Zod resolver for the Header section, build a live preview pane, and prove the bidirectional form-↔-store loop (including undo/redo).

## What we built and WHY each piece exists

### 1. RHF + zodResolver

- `useForm({ resolver: zodResolver(HeaderSchema), defaultValues: header, mode: 'onBlur' })` in `components/editor/HeaderForm.tsx`.
- **Why RHF over Formik or controlled `<input value onChange>`?**
  - **Uncontrolled-first** — RHF registers inputs via a ref instead of mirroring keystrokes into React state. Typing a letter re-renders only the field's error (if any), not the whole form. Formik re-renders on every keystroke; at 50+ fields that's noticeable lag.
  - **Schema is the single source of truth** — `zodResolver(HeaderSchema)` reuses the same Zod schemas the store already uses. No duplicated yup/yup-like schemas to maintain.
  - **Built-in `useFieldArray`** for repeating items (header.links here, Experience.bullets in 4c).
  - **Small bundle** — ~25 KB before tree-shake.

### 2. Bidirectional sync — the _only_ tricky part

```
form ──onBlur per field──► dispatch(updateHeader({…})) ──► store
                                                              │
   ▲                                                          │
   └────────── form.reset(header) on external change ─────────┘
```

Two directions, two failure modes to dodge:

- **Form → store**: each `register('field', { onBlur: commitField('field') })` dispatches a single-field `updateHeader` action when that field blurs. One blur = one undo entry. The undo timeline reads like "edited fullName, edited headline, …" which is exactly what you want.
- **Store → form**: when Undo/Redo/Reset changes the store from _outside_ the form, we have to push the new values back into RHF via `form.reset(header)`. Naïvely doing this on every store change would also reset right after our own onBlur dispatch — losing focus, clearing dirty state, re-rendering. The fix is a `skipNextSyncRef` ref: set it `true` before dispatching, the sync `useEffect` checks the ref and skips one round of `reset()`. Undo/redo don't set the flag, so their changes DO sync into the form.

This pattern generalises to every section form we'll build in 4c.

### 3. `useFieldArray` for header.links

- `components/editor/LinksFieldArray.tsx` shows the simplest possible field-array case (two-input rows).
- **Why `key={field.id}` and not `key={index}`?** `field.id` is RHF's stable per-row id, generated when the row enters the array. Using array index as key means React thinks "row 2 changed" when you swap two rows — inputs lose focus, validation flickers. THE classic React-list bug.
- The remove button calls `remove(index)` then immediately calls `onCommit()` so the store reflects the new array without waiting for a blur.

### 4. Schema strictness — dropped every `.default()`

- Earlier drafts had `headline: z.string().max(200).default('')` etc. **This broke zodResolver's TS generics**: Zod's `.default()` makes the schema _input_ type optional (`headline?: string | undefined`) while leaving the _output_ type required (`headline: string`). RHF's `useForm<T>` doesn't know which to use and complains.
- Our factories (`makeHeader()` in `seedResume.ts`) always emit every field, so `.default()` carried no actual weight. Dropping it everywhere makes `z.input` and `z.output` identical and the resolver types line up cleanly.
- The empty-string allowance for `email` and `links[].url` now comes from a `z.union([z.string().url(), z.literal('')])`, which has matching input/output types.

### 5. Editor layout (`EditorLayout.tsx`)

- Two-pane grid: form on the left (60% width), preview on the right (40%). `lg:sticky lg:top-6` keeps the preview pane visible while you scroll the form on long pages.
- Wrapped in `routes/Editor.tsx` between the undo/redo header and a collapsible `<details>` containing the Phase 4a debug panel + Phase 2 crash button — useful during development but hidden by default.

### 6. Preview pane (`components/preview/`)

- `Preview.tsx` reads all sections, switches on `section.type`, renders the right component. Phase 4b ships `HeaderPreview` only; other section types render a small placeholder so the user sees they exist.
- The exhaustive switch (with `_exhaustive: never`) means adding a `SectionType` without a matching preview is a TypeScript error.
- Pure HTML, no editor chrome — the preview tree will be reused for PDF generation in Phase 7.

### 7. `react-hooks/refs` per-file disable

- The new react-hooks v7 `refs` rule flags `register('field', { onBlur: ...closure that touches a ref... })` as "passing a ref to a function during render".
- That's the _canonical_ RHF pattern; the ref access happens inside an event handler (which React explicitly allows). The rule misclassifies it.
- A single `/* eslint-disable react-hooks/refs -- ... */` at the top of `HeaderForm.tsx` with a clear justification comment is cleaner than five inline disables.

## Phase 4b acceptance criteria

- ✅ `/editor` shows a two-pane layout: form on the left, preview on the right.
- ✅ Editing `fullName`, `email`, etc. → preview updates after you blur the field.
- ✅ Typing `not-an-email` and blurring shows an inline "Invalid email" error.
- ✅ Clicking `+ Add link`, filling label + url, then blurring → preview shows the link as a clickable anchor.
- ✅ Click Undo until past is empty: the form fields revert one edit at a time, focus is preserved on the field you were just on (no rude `form.reset` while typing).
- ✅ Reload — all edits persist (localStorage `persist:resume-ai:resume`).
- ✅ The collapsible debug panel still works (add/remove/reset, crash button).
- ✅ `npm run lint`, `npm run typecheck`, `npm run build` all pass.

## Interview questions Phase 4b prepares you to answer

> **Q:** Why is React Hook Form uncontrolled by default? What's the win?
> **A:** RHF registers each input via a `ref` callback instead of binding `value`/`onChange`. The form's value lives in the DOM (via the input element's own state), not in React state. Result: typing a letter doesn't re-render the form — only the field that needs validation feedback re-renders. Formik (controlled) re-renders on every keystroke, which becomes a perf problem at 50+ fields. Trade-off: integrating with controlled libraries (Material UI's TextField, react-select) needs `<Controller>`, which re-introduces the controlled pattern locally.

> **Q:** How do you sync RHF state with an external store like Redux?
> **A:** Two directions to handle. **Form → store**: dispatch on blur (clean granularity, one undo entry per field-exit) or on debounced watch (live preview, more dispatches). **Store → form**: a `useEffect` that calls `form.reset(externalState)` whenever the slice changes. The gotcha is that your own onBlur dispatches also change the store — you'd reset right after every blur, losing focus. The fix is a "skip next sync" ref: set it `true` immediately before your own dispatch, check it at the top of the sync effect, reset only when it's `false` (i.e., external change).

> **Q:** Why does `useFieldArray` give each row its own `field.id` separate from your data's id?
> **A:** `field.id` is RHF's internal stable identifier for the row, generated when the row enters the array. RHF can't assume your entities have ids of their own, so it makes one. Using `field.id` as the React `key` keeps reconciliation correct across reorders/inserts — using `index` as the key means React thinks "row 2 changed" when you swap two rows, and your inputs lose focus + state. THE classic React-list bug.

> **Q:** What's the trap with Zod's `.default()` and RHF's resolver?
> **A:** `.default()` makes the schema's input type optional (`field?: T | undefined`) while leaving the output type required (`field: T`). `z.infer<typeof S>` returns the output type; RHF's `useForm<T>` uses that as both input and output of the resolver — but `zodResolver(S)` returns a resolver typed with the input shape, which doesn't match. The cleanest fix is to drop `.default()` from forms-facing schemas and ensure factories always emit every field. If you genuinely need defaults for migrations, define a separate `migrationSchema` for the persistence layer.

> **Q:** Why dispatch one action per field instead of one big "save the whole header" action?
> **A:** Two reasons. (1) The undo timeline becomes meaningful — `resume/updateHeader({email})` reads better than `resume/setHeader(...)` 50 times. (2) Smaller payload per action means smaller diffs the renderer has to reconcile. The trade-off is more dispatches; for an editor at human typing speed that's irrelevant.

## What's next: Phase 4c

- Repeating-item sections: Experience, Education, Skills, Projects.
- Each gets its own section form + preview component, following the patterns established here.
- `useFieldArray` does most of the heavy lifting — Experience adds nested field arrays (jobs → bullets) which is where the lesson gets richer.
- The slice grows new reducers: `addItem(sectionId, type)`, `removeItem(sectionId, itemId)`, `updateItem(sectionId, itemId, patch)`, `reorderItems(sectionId, ids)`.
