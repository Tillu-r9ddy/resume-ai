/**
 * EducationPreview — read-only render of an Education section.
 */
import type { EducationItem } from '../../schema/resume';
import { formatYearMonthRange } from './formatYearMonth';

export function EducationPreview({ items }: { items: EducationItem[] }): React.JSX.Element {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Education</h2>
      <div className="mt-2 flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="text-xs italic text-ink-muted">No education entries.</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="flex items-baseline justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink">{item.school || 'School'}</h3>
                <p className="text-xs text-ink-muted">
                  {[item.degree, item.field].filter(Boolean).join(' · ')}
                  {item.gpa && <span> · GPA {item.gpa}</span>}
                </p>
              </div>
              <p className="text-xs text-ink-muted">{formatYearMonthRange(item.start, item.end)}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
