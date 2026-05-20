# Phase 4c — Repeating-Item Section Forms

> Goal: extend the editor with real forms for Experience, Education, Skills, and Projects. Each section becomes editable with full per-field commit, undo/redo, and live preview. The editor is now usable for a real resume.

## What we built and WHY

### 1. Slice extensions — item-level reducers

Four new reducers in `resumeSlice.ts`:

- `addItem({ sectionId })` — appends a fresh item via the per-type factory. Type narrowing inside the reducer means callers don't repeat the section type.
- `removeItem({ sectionId, itemId })` — splices by id.
- `updateItem<T>({ sectionId, itemId, patch })` — Immer-merges a partial onto the named item. Generic over `RepeatingSectionType` so the patch type narrows correctly at call sites.
- `reorderItems({ sectionId, itemIds })` — sets the items array order to the exact list given. Used by 4d's dnd-kit work but cheap to ship now.

All four guard on `section.type === 'header'` and silently no-op for header sections — header is a singleton with no `items` array.

### 2. `useReduxBoundForm` — the sync hook extracted

`hooks/useReduxBoundForm.ts` owns what HeaderForm had inline:

- `useForm` with `defaultValues = storeValue`
- A `useEffect` that calls `form.reset(storeValue)` when storeValue changes
- A `markPendingSelfUpdate()` function: call it right before dispatching to skip the bounceback reset

Every section form (and the refactored HeaderForm) now goes through this hook. The duplication that would otherwise live in five components is gone.

The hook also explicitly documents the stable-reference contract: `storeValue` MUST be referentially stable when nothing changed, otherwise the sync useEffect fires every render and stomps user edits. Section forms satisfy this by memoising the `{ items }` wrapper with `useMemo`.

### 3. Section forms — four flavours of the same pattern

Each section gets one form component:

| Component               | Items shape                                | Special concerns                                                    |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| `ExperienceSectionForm` | company/title/location/start/end/bullets[] | Nested string-array (bullets) + null = "Present" sentinel for `end` |
| `EducationSectionForm`  | school/degree/field/start/end/gpa          | Same null sentinel for `end`, no nested arrays                      |
| `SkillsSectionForm`     | group/items[]                              | Nested string-array (skills) reusing BulletsFieldArray              |
| `ProjectsSectionForm`   | name/summary/link/bullets[]                | Optional URL field, nested bullets                                  |

All four follow the same pattern:

1. Memoise `{ items }` → `storeValue`
2. `useReduxBoundForm` for sync
3. `useFieldArray<TForm, 'items'>` for the items array
4. `commitItemField(itemId, name, index)` factory returns per-blur handler
5. Add button dispatches `addItem` WITHOUT marking self-update (we want the bounceback so the new item appears)
6. Remove button dispatches `removeItem` directly (same rationale)

### 4. The "no markPendingSelfUpdate on add/remove" trick

When the user clicks "+ Add job":

1. Dispatch `addItem({ sectionId })` — store grows by one
2. Parent re-renders with the new `items` array reference
3. `useReduxBoundForm`'s sync useEffect fires (storeValue changed)
4. **No** skip flag is set → `form.reset(...)` runs, RHF's `useFieldArray` picks up the new item with its real (store-generated) id
5. The new card appears

If we'd called `markPendingSelfUpdate()` here, the sync would skip and the new item would never appear in the form until the next external change. The takeaway: `markPendingSelfUpdate` is for _single-field_ dispatches where you want to preserve focus, NOT for structural changes you want reflected immediately.

### 5. BulletsFieldArray — generic but pragmatic

`BulletsFieldArray<T>` handles `string[]` field arrays. Used identically by Experience.bullets, Projects.bullets, and (renamed) Skills.items.

The `name` prop is typed as `string` instead of `ArrayPath<T>` because RHF's `ArrayPath<T>` helper doesn't recurse cleanly into nested array paths (`items.${number}.bullets` isn't recognised by the helper even though it's valid at runtime). Widening to `string` and casting once inside the component is cleaner than casting at every call site. RHF validates the path at runtime when you call `register` / `useFieldArray`, so the runtime correctness is unchanged.

For the React key on each row we use `field.id` from `useFieldArray` — RHF generates a stable synthetic id even for primitive arrays. Using array index as a key would cause the classic "swap rows → both lose focus" bug.

### 6. ItemCard — visual consistency wrapper

`ItemCard` is purely presentational: title, optional badge, remove button, child fields. No RHF, no store knowledge. Keeping the four section forms visually consistent without duplicating the chrome.

Not collapsible yet — that's a 4d polish. Today every item is fully expanded.

### 7. EditorLayout — render all sections in order

`EditorLayout` now iterates `state.resume.present.sections` and renders the matching form per section type. Header stays a singleton (rendered via `HeaderForm` which selects the header itself); the other four types take `sectionId + items` as props.

The Preview pane stays `lg:sticky` so it remains visible while you scroll long forms.

## Phase 4c acceptance criteria

- ✅ `/editor` shows form sections for header + every repeating section in the document
- ✅ "+ Add job / school / group / project" buttons add a new empty item and the form picks it up immediately
- ✅ Per-field onBlur commits the single field; undo walks back per blur
- ✅ Bullets and skill-group items can be added/removed/edited; commit happens on blur
- ✅ Removing an item dispatches `removeItem` and the card disappears
- ✅ Undo restores removed items; redo re-removes them
- ✅ Reload — everything persists (still only `present`, no past/future)
- ✅ Preview pane shows live HTML mirror of every section type (no more placeholders)
- ✅ Lint, typecheck, build pass

## Interview questions Phase 4c prepares you to answer

> **Q:** How do you handle adding a new item to a useFieldArray when the source of truth is in Redux?
> **A:** Dispatch the store-level add action; don't also call the form's local `append`. Your sync useEffect will reset the form to the new store value, which has the just-created item with its real id. If you do both, you briefly have two items (form-local "pending" + store's real one) until the sync reconciles. The "trust the sync" approach has one render of lag but zero id duplication.

> **Q:** When should you NOT call your "skip-next-sync" flag?
> **A:** Whenever you want the form to re-sync to the new store state. Per-field edits set the flag so focus is preserved. Structural changes (add/remove items, undo, redo, load-from-file) should NOT set the flag — you want the form to rebuild from the new state so the changes are visible.

> **Q:** Why memoise the `storeValue` you pass to a Redux-bound form hook?
> **A:** The hook's sync useEffect runs when its `storeValue` dep changes. If you build a fresh wrapper object (`{ items }`) every render, the dep "changes" on every render, the effect runs every render, `form.reset()` fires every render, and the user's in-progress edit gets stomped. `useMemo(() => ({ items }), [items])` produces a stable reference whenever `items` itself is stable (which Immer guarantees when nothing changed in that slice).

> **Q:** Why does `useFieldArray` accept `string[]` even though "the field needs to be an array of objects"?
> **A:** The docs are misleading. RHF auto-generates a synthetic `id` per row regardless of whether the underlying value is an object or a primitive. The synthetic id is what you key on for React reconciliation. The underlying value can still be a string — you register it with `register(\`bullets.${i}\`)` and RHF treats the index path correctly.

> **Q:** Why is your `BulletsFieldArray.name` typed as `string` instead of `ArrayPath<T>`?
> **A:** RHF's `ArrayPath<T>` helper resolves top-level array paths but doesn't recurse cleanly into arrays-nested-inside-arrays. `items.${number}.bullets` is a valid array path at runtime but the type helper doesn't recognise it, so you'd have to cast at every call site. Widening the prop to `string` and casting once inside the component pushes the trade-off into one place; RHF still validates the path at runtime.

> **Q:** How does your `updateItem` reducer narrow the patch type to the right section?
> **A:** The reducer is generic over `RepeatingSectionType extends keyof ItemFor`, where `ItemFor` is a discriminated map from section type to item shape. The payload's `patch` is typed `Partial<ItemFor[T]>`. The call site knows which section type it's editing (Experience form passes Experience-shaped patches), so the generic infers cleanly. Inside the reducer we still have to assert via section.type guard because the runtime section is a member of the wider discriminated union.

## What's next: Phase 4d

- Drag-to-reorder sections and items via dnd-kit
- Section management UI inside the editor (add/remove without the debug panel)
- Optional: collapse/expand items via `<details>` so very long resumes are easier to navigate
- Autosave indicator + dirty state if we want a visible "saved" status
- Maybe split the editor into a left-rail section nav if the form pane gets too tall

After 4d, Phase 4 is "done" and we move to Phase 5 — perf (memo, virtualization, Web Workers, bundle analysis).
