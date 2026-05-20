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
 * In Phase 7 the same tree will be the source for PDF generation — that's
 * why we keep it as pure HTML with no editor-only chrome.
 */
import type { Section } from '../../schema/resume';
import { useAppSelector } from '../../store/hooks';
import { selectSections } from '../../store/selectors';
import { HeaderPreview } from './HeaderPreview';
import { ExperiencePreview } from './ExperiencePreview';
import { EducationPreview } from './EducationPreview';
import { SkillsPreview } from './SkillsPreview';
import { ProjectsPreview } from './ProjectsPreview';

export function Preview(): React.JSX.Element {
  const sections = useAppSelector(selectSections);

  return (
    <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
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
