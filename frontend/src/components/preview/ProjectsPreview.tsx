/**
 * ProjectsPreview — read-only render of a Projects section.
 *
 * memo-wrapped (Phase 5) — see HeaderPreview for the structural-sharing rationale.
 */
import { memo } from 'react';
import type { ProjectItem } from '../../schema/resume';

function ProjectsPreviewInner({ items }: { items: ProjectItem[] }): React.JSX.Element {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Projects</h2>
      <div className="mt-2 flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="text-xs italic text-ink-muted">No projects added.</p>
        ) : (
          items.map((item) => (
            <article key={item.id}>
              <header>
                <h3 className="text-sm font-medium text-ink">
                  {item.name || 'Untitled project'}
                  {item.link && (
                    <>
                      {' '}
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-normal text-accent hover:underline"
                      >
                        ↗
                      </a>
                    </>
                  )}
                </h3>
                {item.summary && <p className="text-xs text-ink-muted">{item.summary}</p>}
              </header>
              {item.bullets.length > 0 && (
                <ul className="mt-1 ml-4 list-disc text-xs text-ink">
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

export const ProjectsPreview = memo(ProjectsPreviewInner);
