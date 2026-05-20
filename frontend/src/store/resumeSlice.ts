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
import { newId, type Header, type Resume, type SectionType } from '../schema/resume';
import { makeSection, seedResume } from './seedResume';

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
  },
});

export const {
  setResume,
  updateHeader,
  addSection,
  removeSection,
  removeLastSection,
  resetResume,
} = resumeSlice.actions;

export const resumeReducer = resumeSlice.reducer;
