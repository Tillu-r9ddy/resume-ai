/**
 * ItemCard — visual wrapper for one item inside a repeating section form.
 *
 * Owns nothing about RHF or the store — purely presentational. The parent
 * section form passes a remove handler and a title (e.g. "Job 1"). The body
 * is whatever fields the section type needs.
 *
 * Why a separate component (instead of inline divs in each section form)?
 *   Visual consistency across Experience / Education / Skills / Projects.
 *   The four section forms are otherwise similar enough that any styling
 *   drift would feel sloppy. Single component, single source of truth for
 *   "what does an item card look like?".
 *
 * Not collapsible yet — that's a 4d polish. Today every item is fully
 * expanded; with a few items per section that's fine.
 */
import type { ReactNode } from 'react';

interface ItemCardProps {
  title: string;
  /** Optional small label to the right of the title — e.g. "current role". */
  badge?: string;
  onRemove: () => void;
  removeLabel?: string;
  children: ReactNode;
}

export function ItemCard({
  title,
  badge,
  onRemove,
  removeLabel = 'Remove item',
  children,
}: ItemCardProps): React.JSX.Element {
  return (
    <article className="rounded-lg border border-border bg-surface-2 p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">
          {title}
          {badge && (
            <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-normal text-ink-muted">
              {badge}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="text-xs font-medium text-ink-muted hover:text-red-300"
        >
          × Remove
        </button>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </article>
  );
}
