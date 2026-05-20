/**
 * Selectors — pure functions from RootState to derived data.
 *
 * Why a dedicated selectors file?
 *   • Single source of truth for "where in the state tree does X live?".
 *     Components import `selectHeader`, not the path `s.resume.present.sections.find(...)`.
 *     When the state shape changes (e.g., normalising sections into a
 *     keyed entity adapter in Phase 9), only this file changes.
 *   • Easy place to add memoisation later (createSelector from reselect /
 *     RTK's `createSelector` re-export) without touching call sites.
 *   • Discoverable: a new contributor looking for "how do I read the
 *     resume?" finds it here, not buried in component files.
 *
 * For Phase 4b we only need `selectHeader`. As 4c/4d arrive we'll add
 * selectSections, selectSectionById, etc.
 */
import type { Header, Section } from '../schema/resume';
import type { RootState } from './index';

/**
 * Pull the singleton header out of `resume.present.sections`.
 *
 * Why nullable? The schema guarantees at most one header section, but
 * a user (or a bad migration) could leave the document without one. Returning
 * `null` instead of throwing forces callers to handle the case — usually by
 * showing a "no header" hint rather than crashing the whole editor.
 */
export const selectHeader = (state: RootState): Header | null => {
  const headerSection = state.resume.present.sections.find((s) => s.type === 'header');
  if (!headerSection || headerSection.type !== 'header') return null;
  return headerSection.data;
};

/**
 * All sections, in render order. Used by the Preview pane.
 */
export const selectSections = (state: RootState) => state.resume.present.sections;

/**
 * Find a section by id. Returns `undefined` if the section isn't in the
 * current document (likely because it was just removed elsewhere). Section
 * forms guard on this — when a form's section disappears mid-render the
 * form unmounts cleanly.
 *
 * Note: this returns the *discriminated-union* Section type. Callers narrow
 * via `section.type === 'experience'` etc. RTK doesn't memoise this for us;
 * for 4c the cost is negligible, but in 4d/5 we'll wrap with createSelector
 * if the section-form list grows beyond a handful.
 */
export const selectSectionById =
  (id: string) =>
  (state: RootState): Section | undefined =>
    state.resume.present.sections.find((s) => s.id === id);
