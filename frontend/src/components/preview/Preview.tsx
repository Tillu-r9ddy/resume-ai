/**
 * Preview — read-only render of the WHOLE resume document.
 *
 * Iterates `state.resume.present.sections` in order and delegates each one
 * to its type-specific renderer.
 *
 * Why a "router" pattern with a switch?
 *   Each section has a distinct visual structure — there's no useful
 *   one-size-fits-all renderer. A switch on `section.type` lets TS narrow
 *   the discriminated union and pass each component a precisely-typed prop.
 *   `_exhaustive: never` in the default branch guarantees that adding a
 *   new SectionType without updating this switch is a compile error.
 *
 * Phase 7 — uses the same tree for PDF (see routes/Print.tsx). That's why
 * we keep it as pure HTML with no editor-only chrome.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why useDeferredValue around the sections?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Typing in the form fires a Redux action → selectSections changes →
 *   Preview re-renders the whole tree. On a large resume (benchmark loads
 *   ~15 jobs + ~10 projects) the cumulative work is ~40 nodes per keystroke.
 *
 *   useDeferredValue tells React: "render the form update at high priority,
 *   render the preview update at low priority — and if a newer update
 *   arrives mid-render, throw the in-progress preview away." The form stays
 *   instant; the preview catches up a frame or two later.
 *
 *   This is cheap because the section components are memoised (Phase 5).
 *   Without the memo, deferring would still render the same total work —
 *   just spread across more frames.
 */
import { useDeferredValue } from 'react';
import type { Section } from '../../schema/resume';
import { useAppSelector } from '../../store/hooks';
import { selectSections } from '../../store/selectors';
import { HeaderPreview } from './HeaderPreview';
import { ExperiencePreview } from './ExperiencePreview';
import { EducationPreview } from './EducationPreview';
import { SkillsPreview } from './SkillsPreview';
import { ProjectsPreview } from './ProjectsPreview';

export function Preview(): React.JSX.Element {
  const liveSections = useAppSelector(selectSections);
  // Deferred — React keeps the previous value during high-priority updates
  // and renders the new one at low priority. See top-of-file rationale.
  const sections = useDeferredValue(liveSections);
  const isStale = sections !== liveSections;

  return (
    <div
      className="rounded-lg border border-border bg-surface p-8 shadow-sm transition-opacity"
      style={{ opacity: isStale ? 0.6 : 1 }}
      aria-busy={isStale}
    >
      {sections.length === 0 ? (
        <p className="text-sm text-ink-muted">
          This resume has no sections yet. Add some from the debug panel below.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <SectionRenderer key={section.id} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionRenderer({ section }: { section: Section }): React.JSX.Element {
  switch (section.type) {
    case 'header':
      return <HeaderPreview header={section.data} />;
    case 'experience':
      return <ExperiencePreview items={section.items} />;
    case 'education':
      return <EducationPreview items={section.items} />;
    case 'skills':
      return <SkillsPreview items={section.items} />;
    case 'projects':
      return <ProjectsPreview items={section.items} />;
    default: {
      // Exhaustiveness — new SectionType without an entry above → TS error.
      const _exhaustive: never = section;
      throw new Error(`Unhandled section type in preview: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
