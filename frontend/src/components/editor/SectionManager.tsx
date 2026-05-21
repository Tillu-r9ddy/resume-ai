/**
 * SectionManager — "+ Add section" menu at the bottom of the form pane.
 *
 * Why a menu (not 4 separate buttons)?
 *   Four "Add Experience / Education / Skills / Projects" buttons would
 *   crowd the editor and look like primary actions. A single menu groups
 *   them under one neutral action surface — easier to extend in 4d.+
 *   (custom section types) and less visual noise.
 *
 * Why no Headless UI / Radix / shadcn dropdown?
 *   For a four-item menu, the native `<details>`/`<summary>` pair is
 *   actually fine: keyboard-accessible by default, no JS for open/close,
 *   collapses on outside click via blur. We'd reach for Radix when we
 *   need more (typeahead, multi-select, async loading) — not before.
 *
 * Header is intentionally not addable: it's a singleton (seed always
 * produces exactly one). Adding more would silently work today but
 * violate the schema invariant — better to keep it out of the menu.
 */
import { useRef } from 'react';
import { SECTION_TYPES, type SectionType } from '../../schema/resume';
import { useAppDispatch } from '../../store/hooks';
import { addSection } from '../../store/resumeSlice';

const ADDABLE: readonly Exclude<SectionType, 'header'>[] = SECTION_TYPES.filter(
  (t): t is Exclude<SectionType, 'header'> => t !== 'header',
);

const SECTION_LABEL: Record<Exclude<SectionType, 'header'>, string> = {
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

export function SectionManager(): React.JSX.Element {
  const dispatch = useAppDispatch();
  // Keep a ref to the <details> so we can close it on selection.
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function add(type: Exclude<SectionType, 'header'>): void {
    dispatch(addSection(type));
    // Close the menu after a selection — feels more like a real dropdown.
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <details
      ref={detailsRef}
      className="group rounded-xl border border-dashed border-border bg-surface/40 p-4"
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-ink-muted hover:text-ink">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">+</span>
          Add section
          <span aria-hidden="true" className="text-xs opacity-60 group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {ADDABLE.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className="rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
          >
            {SECTION_LABEL[type]}
          </button>
        ))}
      </div>
    </details>
  );
}
