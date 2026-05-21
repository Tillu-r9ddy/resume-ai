/* eslint-disable react-hooks/refs --
 * dnd-kit's useSortable() returns a `setNodeRef` callback ref plus `style`
 * and `listeners` objects that are meant to be spread onto the dragged
 * element. The new react-hooks/refs rule treats accessing these via dot
 * notation in JSX as "reading a ref value during render" — but they're
 * dnd-kit's normal API surface, not React refs. The same misclassification
 * we hit with React Hook Form's `register('name', { onBlur })`. Disable
 * here; the rule's intent (don't read .current during render) doesn't
 * apply to spreading dnd-kit bindings onto JSX.
 */
/**
 * EditorLayout — the editor's two-pane shell.
 *
 *   ┌──────────────┬──────────────┐
 *   │  Form pane   │ Preview pane │
 *   │  (60%)       │   (40%)      │
 *   └──────────────┴──────────────┘
 *
 * Phase 4d: the left pane is now a drag-sortable list of sections. Each
 * non-header section can be reordered or removed inline via its header
 * controls. The preview pane stays `lg:sticky` so it remains in view
 * while you scroll long forms.
 *
 * Why include header in the sortable list at all?
 *   It's still a section visually, so it gets the same chrome (title,
 *   border, padding). Its drag handle is disabled (`isHeader` check) so
 *   you can't drop other sections above or below — header always sits
 *   wherever the array puts it. Today the seed puts it first; a 4d.+
 *   release could enforce "header is always first" in the reducer if
 *   needed.
 */
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectSections } from '../../store/selectors';
import { removeSection, reorderSections } from '../../store/resumeSlice';
import type { Section } from '../../schema/resume';
import { HeaderForm } from './HeaderForm';
import { ExperienceSectionForm } from './sections/ExperienceSectionForm';
import { EducationSectionForm } from './sections/EducationSectionForm';
import { SkillsSectionForm } from './sections/SkillsSectionForm';
import { ProjectsSectionForm } from './sections/ProjectsSectionForm';
import { Preview } from '../preview/Preview';
import { SortableList, type SortableRenderProps } from './SortableList';
import { SortableHandle } from './SortableHandle';
import { SectionManager } from './SectionManager';

const SECTION_TITLE: Record<Section['type'], string> = {
  header: 'Header',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

export function EditorLayout(): React.JSX.Element {
  const sections = useAppSelector(selectSections);
  const dispatch = useAppDispatch();

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      {/* ── Form pane ──────────────────────────────────────────────────── */}
      <div aria-label="Resume editor" className="flex flex-col gap-4">
        {sections.length === 0 ? (
          <p className="text-sm text-ink-muted">
            This resume has no sections yet. Use “+ Add section” below.
          </p>
        ) : (
          <SortableList
            items={sections}
            onReorder={(ids) => dispatch(reorderSections({ sectionIds: ids }))}
            renderItem={(section, bindings) => (
              <SectionCard
                section={section}
                bindings={bindings}
                onRemove={() => dispatch(removeSection({ id: section.id }))}
              />
            )}
          />
        )}

        <SectionManager />
      </div>

      {/* ── Preview pane ───────────────────────────────────────────────── */}
      <section aria-label="Resume preview" className="lg:sticky lg:top-6 lg:self-start">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Preview
        </h2>
        <Preview />
      </section>
    </div>
  );
}

/**
 * SectionCard — the chrome around one section form. Owns the drag handle,
 * the remove button, and the title row. The actual form lives inside.
 */
function SectionCard({
  section,
  bindings,
  onRemove,
}: {
  section: Section;
  bindings: SortableRenderProps;
  onRemove: () => void;
}): React.JSX.Element {
  const isHeader = section.type === 'header';
  return (
    <section
      ref={bindings.setNodeRef}
      style={bindings.style}
      aria-label={SECTION_TITLE[section.type]}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SortableHandle
            listeners={bindings.listeners}
            disabled={isHeader}
            label={
              isHeader
                ? 'Header is fixed in place'
                : `Drag to reorder ${SECTION_TITLE[section.type]}`
            }
          />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
            {SECTION_TITLE[section.type]}
          </h2>
        </div>
        {!isHeader && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${SECTION_TITLE[section.type]} section`}
            className="text-xs font-medium text-ink-muted hover:text-red-300"
          >
            × Remove section
          </button>
        )}
      </header>
      <SectionForm section={section} />
    </section>
  );
}

function SectionForm({ section }: { section: Section }): React.JSX.Element {
  switch (section.type) {
    case 'header':
      // Header is a singleton — HeaderForm reads it via selectHeader.
      return <HeaderForm />;
    case 'experience':
      return <ExperienceSectionForm sectionId={section.id} items={section.items} />;
    case 'education':
      return <EducationSectionForm sectionId={section.id} items={section.items} />;
    case 'skills':
      return <SkillsSectionForm sectionId={section.id} items={section.items} />;
    case 'projects':
      return <ProjectsSectionForm sectionId={section.id} items={section.items} />;
    default: {
      const _exhaustive: never = section;
      throw new Error(`Unhandled section in editor: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
