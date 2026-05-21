/**
 * ItemCard — visual wrapper for one item inside a repeating section form.
 *
 * Owns nothing about RHF or the store — purely presentational. The parent
 * section form passes a remove handler and a title (e.g. "Job 1"). The body
 * is whatever fields the section type needs.
 *
 * Phase 4d: accepts an optional `bindings` prop from SortableList. When
 * present, the card becomes draggable — the bindings spread onto the root
 * element (ref + style for the dnd transform) and the header gets a
 * SortableHandle. When absent, the card renders as before with no drag UI.
 * Keeping bindings optional means tests / stories can still render an
 * ItemCard without setting up a DndContext.
 */
import type { ReactNode } from 'react';
import type { SortableRenderProps } from './SortableList';
import { SortableHandle } from './SortableHandle';

interface ItemCardProps {
  title: string;
  /** Optional small label to the right of the title — e.g. "current role". */
  badge?: string;
  onRemove: () => void;
  removeLabel?: string;
  /** When set, the card is draggable via the SortableHandle in its header. */
  bindings?: SortableRenderProps;
  children: ReactNode;
}

export function ItemCard({
  title,
  badge,
  onRemove,
  removeLabel = 'Remove item',
  bindings,
  children,
}: ItemCardProps): React.JSX.Element {
  return (
    <article
      ref={bindings?.setNodeRef}
      style={bindings?.style}
      className="rounded-lg border border-border bg-surface-2 p-4"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {bindings && (
            <SortableHandle listeners={bindings.listeners} label={`Drag to reorder · ${title}`} />
          )}
          <h3 className="text-sm font-medium text-ink">
            {title}
            {badge && (
              <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-normal text-ink-muted">
                {badge}
              </span>
            )}
          </h3>
        </div>
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
