/**
 * ExperiencePreview — read-only render of an Experience section.
 *
 * ATS-friendly: plain semantic HTML, no icons or stylistic chrome that
 * resume parsers struggle with. The visual hierarchy is purely typographic.
 *
 * memo-wrapped: see HeaderPreview for the rationale — Immer keeps `items`
 * referentially stable when the change is in some other section, so shallow
 * equality skips this whole subtree on those keystrokes.
 */
import { memo } from 'react';
import type { ExperienceItem } from '../../schema/resume';
import { formatYearMonthRange } from './formatYearMonth';

function ExperiencePreviewInner({ items }: { items: ExperienceItem[] }): React.JSX.Element {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Experience</h2>
      <div className="mt-2 flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-xs italic text-ink-muted">No jobs added.</p>
        ) : (
          items.map((item) => (
            <article key={item.id}>
              <header className="flex items-baseline justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-ink">
                    {item.title || 'Untitled role'}
                    {item.company && (
                      <>
                        <span className="text-ink-muted"> · </span>
                        <span className="text-ink-muted">{item.company}</span>
                      </>
                    )}
                  </h3>
                  {item.location && <p className="text-xs text-ink-muted">{item.location}</p>}
                </div>
                <p className="text-xs text-ink-muted">
                  {formatYearMonthRange(item.start, item.end)}
                </p>
              </header>
              {item.bullets.length > 0 && (
                <ul className="mt-2 ml-4 list-disc text-xs text-ink">
                  {item.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export const ExperiencePreview = memo(ExperiencePreviewInner);
