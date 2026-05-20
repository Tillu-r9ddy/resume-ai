/**
 * EditorLayout — the editor's two-pane shell.
 *
 *   ┌──────────────┬──────────────┐
 *   │  Form pane   │ Preview pane │
 *   │  (60%)       │   (40%)      │
 *   └──────────────┴──────────────┘
 *
 * Phase 4c: the left pane is now a vertical stack of section forms — one
 * per section in the document, in render order. The right pane stays
 * sticky on `lg+` so the preview stays in view while you scroll the form.
 *
 * Why iterate `sections` directly (instead of a section-picker rail)?
 *   Editors users actually use (Notion, Linear's compose) tend to favour
 *   "see everything, scroll through it" over modal section nav. Less UI
 *   chrome, less hidden state, easier to grok. We can add a side-rail
 *   later if the document grows beyond what's comfortable to scroll.
 */
import { useAppSelector } from '../../store/hooks';
import { selectSections } from '../../store/selectors';
import type { Section } from '../../schema/resume';
import { HeaderForm } from './HeaderForm';
import { ExperienceSectionForm } from './sections/ExperienceSectionForm';
import { EducationSectionForm } from './sections/EducationSectionForm';
import { SkillsSectionForm } from './sections/SkillsSectionForm';
import { ProjectsSectionForm } from './sections/ProjectsSectionForm';
import { Preview } from '../preview/Preview';

const SECTION_TITLE: Record<Section['type'], string> = {
  header: 'Header',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

export function EditorLayout(): React.JSX.Element {
  const sections = useAppSelector(selectSections);

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      {/* ── Form pane ──────────────────────────────────────────────────── */}
      <div aria-label="Resume editor" className="flex flex-col gap-4">
        {sections.length === 0 ? (
          <p className="text-sm text-ink-muted">
            This resume has no sections yet. Add some via the debug panel below.
          </p>
        ) : (
          sections.map((section) => (
            <section
              key={section.id}
              aria-label={SECTION_TITLE[section.type]}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <header className="mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
                  {SECTION_TITLE[section.type]}
                </h2>
              </header>
              <SectionForm section={section} />
            </section>
          ))
        )}
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
