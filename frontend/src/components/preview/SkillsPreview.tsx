/**
 * SkillsPreview — read-only render of a Skills section.
 *
 * Each group is rendered as "Group: skill, skill, skill" — compact and
 * ATS-parser-friendly. Avoid pill / badge layouts that don't translate
 * well to plain-text resume parsers.
 */
import type { SkillsItem } from '../../schema/resume';

export function SkillsPreview({ items }: { items: SkillsItem[] }): React.JSX.Element {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Skills</h2>
      <div className="mt-2 flex flex-col gap-1">
        {items.length === 0 ? (
          <p className="text-xs italic text-ink-muted">No skill groups.</p>
        ) : (
          items.map((group) => (
            <p key={group.id} className="text-xs text-ink">
              <span className="font-medium">{group.group || 'Group'}:</span>{' '}
              <span className="text-ink-muted">
                {group.items.filter((s) => s.trim().length > 0).join(', ') || 'no skills listed'}
              </span>
            </p>
          ))
        )}
      </div>
    </section>
  );
}
