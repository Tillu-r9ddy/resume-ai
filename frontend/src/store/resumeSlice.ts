/**
 * resumeSlice — the canonical resume document, owned by Redux Toolkit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why RTK for THIS slice (and not Zustand, the way the UI store works)?
 * ─────────────────────────────────────────────────────────────────────────────
 *   The resume document needs:
 *     1. Time-travel — every edit should be undoable, every undo redoable.
 *        redux-undo plugs into the Redux store via reducer wrapping; no
 *        equivalent exists for Zustand without writing it from scratch.
 *     2. Action log — every change is a named action ('resume/updateHeader'),
 *        which makes debugging in DevTools obvious.
 *     3. Normalisation later — when sections grow, createEntityAdapter from
 *        RTK gives us O(1) lookups + memoised selectors out of the box.
 *     4. Industry pattern — RTK is what large teams ship; the editor is the
 *        most "real-product" piece of this codebase, so it gets the
 *        most-conventional state library.
 *
 *   UI flags (sidebar, theme) stay in Zustand. Mixing two state libraries is
 *   FINE when each is chosen for the right reason — see the deep dives in
 *   docs/03a (Zustand) and docs/04a (RTK).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why createSlice (and not the older `createReducer` + action-creator dance)?
 * ─────────────────────────────────────────────────────────────────────────────
 *   `createSlice` generates the reducer, the action creators, AND the action
 *   type strings from a single declaration. It also pipes everything through
 *   Immer so reducers can use mutating syntax (`state.title = '...'`) safely.
 *   The output is structurally identical to a hand-written reducer; you just
 *   write 5× less boilerplate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * About `extraReducers` and the `present`/`past`/`future` shape
 * ─────────────────────────────────────────────────────────────────────────────
 *   This slice's reducer operates on a *plain Resume*. The store wraps it with
 *   `undoable(...)` in store/index.ts, which produces a `{past, present,
 *   future}` shape. So action creators dispatched from components still look
 *   like `dispatch(addSection('experience'))` — the wrapping is invisible.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  newId,
  type EducationItem,
  type ExperienceItem,
  type Header,
  type ProjectItem,
  type Resume,
  type SectionType,
  type SkillsItem,
} from '../schema/resume';
import {
  makeEducationItem,
  makeExperienceItem,
  makeProjectItem,
  makeSection,
  makeSkillsItem,
  seedResume,
} from './seedResume';

/**
 * Discriminated map from section type → its item shape. Lets `addItem`
 * narrow the payload type once at the call site without leaking the union
 * through to consumers.
 */
type ItemFor = {
  experience: ExperienceItem;
  education: EducationItem;
  skills: SkillsItem;
  projects: ProjectItem;
};
type RepeatingSectionType = keyof ItemFor;

/**
 * Initial state — a fresh seed each store boot. redux-persist will REPLACE
 * this with the persisted snapshot on rehydration; the seed is only the
 * very-first-run fallback.
 */
const initialState: Resume = seedResume();

const resumeSlice = createSlice({
  name: 'resume',
  initialState,
  reducers: {
    /**
     * Replace the whole document. Useful for "load from file", "load from
     * server", and "reset to default". When you return a value from an Immer
     * reducer, that return value REPLACES the draft entirely.
     */
    setResume: (_state, action: PayloadAction<Resume>) => action.payload,

    /**
     * Patch the header section's data. Uses Immer mutation so we don't have
     * to spread the path back up to the root. Throws-friendly: if the header
     * section is missing (someone deleted it manually), we silently no-op.
     */
    updateHeader: (state, action: PayloadAction<Partial<Header>>) => {
      const header = state.sections.find((s) => s.type === 'header');
      if (header && header.type === 'header') {
        Object.assign(header.data, action.payload);
      }
    },

    /**
     * Append a new section of the given type. The factory in seedResume.ts
     * owns "what does an empty section look like?" — see makeSection.
     */
    addSection: (state, action: PayloadAction<SectionType>) => {
      state.sections.push(makeSection(action.payload));
    },

    /**
     * Remove a section by id. We use `splice` instead of `filter` so Immer
     * can produce a small patch instead of replacing the whole array.
     */
    removeSection: (state, action: PayloadAction<{ id: string }>) => {
      const idx = state.sections.findIndex((s) => s.id === action.payload.id);
      if (idx >= 0) state.sections.splice(idx, 1);
    },

    /**
     * Convenience: remove the LAST section. Lets the debug panel demonstrate
     * removal without needing to thread a specific id through.
     */
    removeLastSection: (state) => {
      state.sections.pop();
    },

    /**
     * Reset to a freshly-seeded resume. Generates new IDs each time so undo
     * history doesn't confuse "reset to seed" with "we're back at the start".
     */
    resetResume: () => ({ ...seedResume(), id: newId() }),

    // ── Item-level reducers (Phase 4c) ────────────────────────────────────
    // These all share the same shape: find the section by id, then mutate
    // its items array. The section-type guard inside each reducer narrows
    // the discriminated union — without it, TS can't prove that
    // `section.items` exists (header sections don't have items).

    /**
     * Append a new empty item to a repeating section. Type is inferred from
     * the section we found, so the caller doesn't need to repeat it.
     * No-op for header sections (they're singletons).
     */
    addItem: (state, action: PayloadAction<{ sectionId: string }>) => {
      const section = state.sections.find((s) => s.id === action.payload.sectionId);
      if (!section || section.type === 'header') return;
      // Switch on the narrowed type so we call the right factory.
      switch (section.type) {
        case 'experience':
          section.items.push(makeExperienceItem());
          break;
        case 'education':
          section.items.push(makeEducationItem());
          break;
        case 'skills':
          section.items.push(makeSkillsItem());
          break;
        case 'projects':
          section.items.push(makeProjectItem());
          break;
      }
    },

    /**
     * Remove an item from a repeating section by id. Splice instead of
     * filter so Immer produces a small patch.
     */
    removeItem: (state, action: PayloadAction<{ sectionId: string; itemId: string }>) => {
      const section = state.sections.find((s) => s.id === action.payload.sectionId);
      if (!section || section.type === 'header') return;
      const idx = section.items.findIndex((item) => item.id === action.payload.itemId);
      if (idx >= 0) section.items.splice(idx, 1);
    },

    /**
     * Patch a single item inside a repeating section. `patch` is a Partial
     * of whatever item shape that section owns — we use a structural
     * Object.assign so the caller doesn't have to spell every field.
     *
     * Type assertion note: TS can't prove `patch` matches `section.items[i]`
     * here because the section type is widened to the discriminated union.
     * The caller is responsible for sending a patch that fits the section's
     * type. In practice the section forms are typed per-section, so this
     * is safe at the boundary.
     */
    updateItem: <T extends RepeatingSectionType>(
      state: Resume,
      action: PayloadAction<{
        sectionId: string;
        itemId: string;
        patch: Partial<ItemFor[T]>;
      }>,
    ) => {
      const section = state.sections.find((s) => s.id === action.payload.sectionId);
      if (!section || section.type === 'header') return;
      const item = section.items.find((it) => it.id === action.payload.itemId);
      if (item) Object.assign(item, action.payload.patch);
    },

    /**
     * Reorder a section's items to the exact order given by `itemIds`.
     * Ids not present in the section are dropped; ids in the section but
     * missing from the new order keep their current relative position at
     * the end (defensive — shouldn't happen if the UI is sending a complete
     * list, but cheaper than throwing).
     */
    reorderItems: (state, action: PayloadAction<{ sectionId: string; itemIds: string[] }>) => {
      const section = state.sections.find((s) => s.id === action.payload.sectionId);
      if (!section || section.type === 'header') return;
      const byId = new Map(section.items.map((it) => [it.id, it]));
      const reordered: typeof section.items = [];
      for (const id of action.payload.itemIds) {
        const item = byId.get(id);
        if (item) {
          reordered.push(item as never);
          byId.delete(id);
        }
      }
      // Append any leftovers (defensive).
      for (const leftover of byId.values()) reordered.push(leftover as never);
      section.items = reordered as never;
    },

    /**
     * Reorder the document's sections to the order given by `sectionIds`.
     * Same shape as reorderItems, but at the section level — driven by
     * dnd-kit's onDragEnd from Phase 4d.
     *
     * Defensive: ids in the array that don't match any section are dropped;
     * sections in the document but missing from the array stay at the end.
     */
    reorderSections: (state, action: PayloadAction<{ sectionIds: string[] }>) => {
      const byId = new Map(state.sections.map((s) => [s.id, s]));
      const reordered: typeof state.sections = [];
      for (const id of action.payload.sectionIds) {
        const section = byId.get(id);
        if (section) {
          reordered.push(section);
          byId.delete(id);
        }
      }
      for (const leftover of byId.values()) reordered.push(leftover);
      state.sections = reordered;
    },
  },
});

export const {
  setResume,
  updateHeader,
  addSection,
  removeSection,
  removeLastSection,
  resetResume,
  addItem,
  removeItem,
  updateItem,
  reorderItems,
  reorderSections,
} = resumeSlice.actions;

export const resumeReducer = resumeSlice.reducer;
