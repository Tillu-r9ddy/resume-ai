/**
 * Preview — read-only render of the WHOLE resume document.
 *
 * Iterates `state.resume.present.sections` in order and delegates each one
 * to its type-specific renderer (HeaderPreview today; ExperiencePreview,
 * SkillsPreview, etc. land in 4c/4d).
 *
 * Why a "router" pattern with a switch?
 *   Each section has a distinct visual structure — there's no useful
 *   one-size-fits-all renderer. A switch on `section.type` lets TS narrow
 *   the discriminated union and pass each component a precisely-typed prop.
 *   `_exhaustive: never` in the default branch guarantees that adding a
 *   new SectionType without updating this switch is a compile error.
 *
 * The preview lives in the editor's right pane today. In Phase 7 the same
 * tree will be the source for PDF generation (react-pdf / Puppeteer) — that's
 * why we keep it as pure HTML with no editor-only chrome.
 */
import type { Section } from '../../schema/resume';
import { useAppSelector } from '../../store/hooks';
import { selectSections } from '../../store/selectors';
import { HeaderPreview } from './HeaderPreview';

export function Preview(): React.JSX.Element {
  const sections = useAppSelector(selectSections);

  return (
    /*
     * Visual frame: a "page-like" white-ish surface so the preview is
     * obviously distinct from the editor chrome. Padding mirrors what
     * a printed page margin would feel like.
     */
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
    case 'education':
    case 'skills':
    case 'projects':
      // Phase 4b ships only the header renderer. Other sections show a
      // labeled placeholder so the user can see they exist in the document
      // without us pretending to render content we don't have yet.
      return <SectionPlaceholder type={section.type} count={section.items.length} />;

    default: {
      // Exhaustiveness check. New SectionType without an entry above → TS error.
      const _exhaustive: never = section;
      throw new Error(`Unhandled section type in preview: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function SectionPlaceholder({
  type,
  count,
}: {
  type: 'experience' | 'education' | 'skills' | 'projects';
  count: number;
}): React.JSX.Element {
  return (
    <section className="rounded-md border border-dashed border-border px-4 py-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">{type}</h2>
      <p className="mt-1 text-xs text-ink-muted">
        {count} item{count === 1 ? '' : 's'} · renderer lands in Phase 4c
      </p>
    </section>
  );
}
