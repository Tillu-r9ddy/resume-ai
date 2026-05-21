# Phase 4d — Reorder, Section Management, and Autosave Polish

> Goal: take the four section forms from Phase 4c and make the editor feel like a real product. Sections and items become drag-to-reorder. The debug panel stops being the only way to add sections. An autosave pill confirms every keystroke is safely persisted. After this phase, Phase 4 is "done" — the editor is usable for a real resume.

## What we built and WHY

### 1. `@dnd-kit` for drag-and-drop

We added three packages:

| Package              | Why                                                                              |
| -------------------- | -------------------------------------------------------------------------------- |
| `@dnd-kit/core`      | `DndContext`, sensors (pointer + keyboard), collision detection                  |
| `@dnd-kit/sortable`  | `SortableContext`, `useSortable`, `verticalListSortingStrategy`                  |
| `@dnd-kit/utilities` | `CSS.Transform.toString(...)` helper — converts dnd-kit's transform shape to CSS |

Why dnd-kit and not the more familiar alternatives:

- **react-beautiful-dnd** — Atlassian archived the repo in 2024. It breaks in React 18+ StrictMode (visible double-mount artefacts) and doesn't see new releases. Re-using it on a new project signals "stopped checking the ecosystem in 2022."
- **react-dnd** — lower-level toolkit. Excellent for trees, kanban boards, and graph editors; verbose for a flat sortable list. We'd reach for it if we needed cross-list dragging with custom collision math.
- **Hand-roll on the Pointer Events API** — feasible (~150 LOC) but loses keyboard a11y for free, and we'd reinvent collision detection and accessibility announcements. Buying ~16 KB gzipped to skip that is the right trade.

### 2. `SortableList<T>` — one component, two surfaces

`components/editor/SortableList.tsx` is the only place we touch dnd-kit. Both EditorLayout (for sections) and every section form (for items) call it.

Shape:

```tsx
<SortableList
  items={items}
  onReorder={(newIds) => dispatch(...)}
  renderItem={(item, bindings) => (
    <YourCard ref={bindings.setNodeRef} style={bindings.style}>
      <YourHeader>
        <SortableHandle listeners={bindings.listeners} />
      </YourHeader>
      ...
    </YourCard>
  )}
/>
```

Three design decisions worth highlighting:

1. **`activationConstraint: { distance: 4 }`** on the PointerSensor. Without this, _any_ pointer-down on the card starts a drag — which destroys clicking into input fields. Four pixels of slop is enough that "click" and "drag" stay distinct without feeling sluggish.
2. **`KeyboardSensor` paired with `sortableKeyboardCoordinates`**. Tab to the SortableHandle, Space/Enter to pick up, arrow keys to move, Esc to cancel. Free keyboard a11y; the alternative is a separate "move up / move down" button pair per row, which doubles the chrome.
3. **Render-prop API**. The list doesn't know what your items look like. The caller spreads `bindings.setNodeRef` + `bindings.style` onto whatever root element makes sense and gives `bindings.listeners` to the small handle component. This is what lets the same SortableList drive both section reordering (where the root is a `<section>` with a header bar) and item reordering (where the root is an `<article>` ItemCard).

### 3. `SortableHandle` — split listeners from the drag area

`useSortable` returns a `listeners` object meant to be spread onto an element. The naive thing is to spread them onto the whole sortable element, but then clicking _anywhere_ in the card starts a drag — including in input fields. Hostile.

The fix: split the handle into its own `<button>`, hand it `listeners`, and leave the rest of the card free. dnd-kit's distance constraint already prevents most accidental drags, but moving the listeners to a dedicated handle is the canonical pattern and gives a clear affordance.

A11y wiring:

- Real `<button type="button">` so it's keyboard-focusable.
- `aria-label` describes what reordering happens (e.g., "Drag to reorder · Job 2").
- Icon (`⋮⋮`) is `aria-hidden="true"`; the label is what screen readers announce.
- `disabled` prop for the singleton Header section — it shows the handle in a faded state so the layout stays consistent, but listeners aren't spread.

### 4. Slice extension — `reorderSections`

Added one new reducer:

```ts
reorderSections: (state, action: PayloadAction<{ sectionIds: string[] }>) => {
  const byId = new Map(state.sections.map((s) => [s.id, s]));
  const reordered: typeof state.sections = [];
  for (const id of action.payload.sectionIds) {
    const section = byId.get(id);
    if (section) { reordered.push(section); byId.delete(id); }
  }
  for (const leftover of byId.values()) reordered.push(leftover);
  state.sections = reordered;
},
```

Same id-rebuild pattern as `reorderItems` from 4c. Two defensive properties matter:

1. **Ids not in the section list are silently dropped.** If the UI sends a stale id (race with a removal), the reducer just ignores it instead of crashing.
2. **Sections present in state but absent from the payload keep their position at the end.** A bug in the UI that sends a partial list won't accidentally delete a section. (We could also throw — but defensive feels right for an editor where data loss is the worst outcome.)

Both `reorderSections` and `reorderItems` flow through redux-undo automatically — every reorder becomes a single undo step.

### 5. `EditorLayout` — sections become sortable

`EditorLayout.tsx` now wraps the section list in `SortableList`. Each entry renders a `SectionCard` that owns:

- The drag handle (disabled for header)
- The section title
- The "× Remove section" button (hidden for header)
- The section's actual form (HeaderForm or one of the four section forms)

Header is included in the sortable list visually (so it gets the same chrome) but its handle is disabled. Today's seed always puts header first; if we ever want to enforce "header is always at index 0" we'd add a guard inside `reorderSections`.

### 6. Section forms — items become sortable

Each of the four section forms now wraps its items in `SortableList`:

```tsx
<SortableList
  items={items}
  onReorder={(itemIds) => dispatch(reorderItems({ sectionId, itemIds }))}
  renderItem={(item, bindings) => {
    const index = items.findIndex((it) => it.id === item.id);
    if (index < 0) return null;
    const itemId = item.id;
    const itemErrors = errors.items?.[index];
    return (
      <ItemCard
        title={`Job ${index + 1}`}
        onRemove={() => dispatch(removeItem({ sectionId, itemId }))}
        bindings={bindings}
      >
        ...fields with register(`items.${index}.field`)...
      </ItemCard>
    );
  }}
/>
```

The trick: **pass the store's `items` array (not RHF's `fields`) to SortableList, and look up `index` by id inside `renderItem`.** Why?

- The store's array is what we dispatch reorders against — using its ids keeps the data flow honest.
- RHF's `fields` array would also work for keys, but then we'd be mixing two sources of truth for "the current order." The form already syncs from the store via `useReduxBoundForm`, so the store is the canonical order.
- `index` is still computed from the store array so all the `register(\`items.${index}.field\`)` paths resolve correctly.

After a drop, the dispatch lands, `useReduxBoundForm` syncs the form to the new order, and RHF's `useFieldArray` rebuilds with the new positions.

### 7. `ItemCard` made drag-aware (optionally)

`ItemCard` accepts an optional `bindings` prop. When present, it spreads `ref={bindings.setNodeRef}` + `style={bindings.style}` on the root `<article>` and renders a `SortableHandle` in the header next to the title. When absent, it renders exactly as in 4c.

Keeping `bindings` optional means tests / Storybook stories can still render an ItemCard outside of a `DndContext` without crashing on missing-context errors.

### 8. `SectionManager` — proper "+ Add section" UI

`SectionManager.tsx` lives at the bottom of the form pane: a `<details>` element with a "+ Add section ▾" summary that expands into the four addable section types.

Why a `<details>` and not a Headless UI / Radix dropdown?

- The native element is keyboard-accessible by default (Space/Enter to toggle).
- Closes on outside click via blur — no listener wiring.
- Zero JS for open/close — just a `ref` to close it after a selection.
- For four items this is plenty; Radix is the right call when we need typeahead, multi-select, or async loading. Not before.

Header is intentionally not in the addable list. The schema treats it as a singleton; adding a second header would silently work today but break invariants later (which would be the first header?). Keeping it out of the menu prevents the question entirely.

### 9. `useSavedStatus` + `AutosaveIndicator` — visible "saved" pill

`hooks/useSavedStatus.ts` subscribes to `past.length + future.length` on the resume slice plus the `present` reference. Any dispatch grows past (or clears future); identity-replacing flows (like `setResume`) change `present`'s reference. On any change, it flips to `'saving'` for `600ms`, then settles to `'saved'`.

`components/editor/AutosaveIndicator.tsx` renders a small pill with a pulsing dot — "Saving…" in accent, "Saved" in muted. `role="status"` + `aria-live="polite"` so screen readers announce status changes without being noisy.

Two intentional simplifications:

- **The pill is a perceptual cue, not a real save status.** localStorage is synchronous, so by the time we render "Saving…" the write has already happened. The pill exists because users _expect_ an autosave editor to acknowledge the save; without it the editor feels like nothing's happening.
- **The first render is skipped.** A `isFirstRunRef` skips the initial mount so the pill starts as "Saved" instead of flashing "Saving…" on page load.

Phase 6 will replace this with real network status when the FastAPI backend lands — "Saving…" while the request is in flight, "Saved · 12:34 PM" with the last-saved timestamp, "Offline · 3 pending" when the network fails. Same component, real signal.

### 10. The `react-hooks/refs` ESLint workaround (again)

The new `react-hooks/refs` rule flagged `bindings.setNodeRef`, `bindings.style`, and `bindings.listeners` as "reading a ref value during render" — same misclassification we hit with RHF's `register('name', { onBlur })` in 4b. dnd-kit's `setNodeRef` is a callback ref (a function), `style` is a plain object, and `listeners` is a plain event-handler bag. None of them are React refs in the `.current` sense.

Per-file disable on `EditorLayout.tsx` with a comment explaining why. We could also add a global override in `eslint.config.js` for files using dnd-kit, but per-file with a justification is more honest — anyone reading the file sees why the rule is disabled.

`ItemCard.tsx` doesn't need the disable because it accesses bindings via optional chaining (`bindings?.setNodeRef`), which the rule doesn't flag.

## Phase 4d acceptance criteria

- ✅ Sections can be dragged to reorder; header sits where the store puts it and isn't draggable
- ✅ Items can be dragged to reorder within their section
- ✅ Keyboard reorder works: Tab to handle → Space → Arrow Up/Down → Space (Esc cancels)
- ✅ Reorders are single undo steps (redux-undo wraps the reducer automatically)
- ✅ "+ Add section" menu replaces the dev-panel buttons for adding sections
- ✅ Header section can be removed (it can't — the × is hidden); other sections show × Remove
- ✅ AutosaveIndicator flips to "Saving…" on any change, settles to "Saved"
- ✅ Reload — the new order persists (still only `present`, no past/future)
- ✅ Lint, typecheck, build pass (Editor chunk ~105 KB / 32 KB gzipped)

## Interview questions Phase 4d prepares you to answer

> **Q:** Why pick `@dnd-kit` over `react-beautiful-dnd` or `react-dnd` in 2026?
> **A:** react-beautiful-dnd was archived by Atlassian in 2024 and has visible bugs under React 18+ StrictMode — picking it on a new project signals you stopped checking the ecosystem. react-dnd is excellent for complex tree/graph cases but verbose for a flat sortable list. dnd-kit ships sensors (pointer + keyboard out of the box), is ~16 KB gzipped, and the SortableContext API maps cleanly to "give me a list of ids and a render prop." For a flat sortable list with keyboard a11y as a hard requirement, it's the right shape.

> **Q:** How do you prevent dragging from interfering with clicking into input fields?
> **A:** Two things working together. First, the PointerSensor's `activationConstraint: { distance: 4 }` — dnd-kit only treats a pointer movement as a drag after 4 px of motion, so a click into a text input doesn't accidentally lift the card. Second, the `listeners` from `useSortable` go ONLY on a dedicated `<SortableHandle>` button in the card header, not on the whole card. The rest of the card is free for normal interaction.

> **Q:** How does keyboard drag work with dnd-kit?
> **A:** Add a `KeyboardSensor` configured with `sortableKeyboardCoordinates` from `@dnd-kit/sortable`. The SortableHandle is a real `<button>`, so it's tab-focusable. Space/Enter "picks up," arrow keys move the dragged item up or down with auto-scrolling, Space/Enter drops, Esc cancels. Screen readers get position announcements from dnd-kit's built-in `accessibility` API. The whole thing requires zero extra code on the consumer side beyond registering the sensor.

> **Q:** Why pass the store's items array to SortableList instead of RHF's `fields`?
> **A:** The dispatch on drop reorders the _store_, which is the source of truth. Using the store's array means the ids you're reordering are the same ids the reducer sees — no translation layer. RHF's `fields` array has synthetic ids that survive only for the lifetime of that form instance; mixing them in would create two sources of truth for "current order." The form re-syncs from the store after the dispatch via `useReduxBoundForm`, so by the next render RHF and the store agree again.

> **Q:** How do you make a reorder a single undo step?
> **A:** Free with redux-undo. Each reducer call produces one entry in `past`, so dispatching `reorderSections({ sectionIds })` once per drop gives you one undo step. The trick is to compute the final order in the dnd-kit `onDragEnd` handler and dispatch a single action with the complete new order, NOT to dispatch a stream of "move from A to B" actions during the drag itself.

> **Q:** What's a defensive reducer pattern for reorders?
> **A:** Build a map of id → item, then iterate the payload's id list and pull from the map. Two free wins: ids in the payload that don't exist in state are silently dropped (handles UI/state race conditions), and items in state that are missing from the payload get appended at the end (a buggy UI sending a partial list won't lose data). Same pattern works for both section reorders and item reorders.

> **Q:** Why is the AutosaveIndicator not a "real" save status?
> **A:** Because localStorage is synchronous — by the time the component renders "Saving…" the write has already completed. The pill is a perceptual cue: users expect an autosave editor to acknowledge keystrokes, and a 600 ms flash to "Saving…" lets them see the system reacting. When the FastAPI backend lands in Phase 6, the indicator wires to actual network status: "Saving…" while a request is in flight, "Saved · 12:34 PM" on success, "Offline · 3 pending" on failure. Same component, real signal.

> **Q:** Why use a native `<details>` for the Add Section menu instead of Radix or Headless UI?
> **A:** For a four-item, single-select menu, `<details>`/`<summary>` is keyboard-accessible by default, closes on blur, and needs zero JS for open/close — just a ref to close it after a selection. Reach for a real popover library when you need typeahead, async loading, multi-select, or floating positioning. We don't, so the bigger dependency would be over-engineering.

> **Q:** Why split the drag handle out of the card instead of making the whole card draggable?
> **A:** `useSortable`'s `listeners` attach pointer events to whatever element you spread them on. Spreading them on the whole card means clicking _anywhere_ inside (including input fields) starts a drag, which destroys form usability. Putting them on a small handle in the header preserves all normal interactions in the rest of the card and gives a clear affordance for where to grab. The handle button also doubles as the keyboard a11y target.

## What's next: Phase 5 — Performance

Phase 4 is done. Next we move to performance work:

- `React.memo` / `useMemo` where the editor genuinely re-renders too much (and where it doesn't — measure first)
- Virtualization for very long resumes (probably react-virtual)
- Web Worker offloading for the PDF generation step (deferred until Phase 7 mounts the actual generator)
- Bundle analysis: split chunks for editor vs preview, lazy-load section forms by type

Phase 5's deliverable is a measurable before/after, not just "we added memo everywhere." React DevTools Profiler + a structured benchmark resume should drive the changes.
