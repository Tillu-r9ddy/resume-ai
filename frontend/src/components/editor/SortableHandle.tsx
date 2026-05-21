/**
 * SortableHandle — the small drag-grip you grab to reorder.
 *
 * Why a separate component?
 *   `useSortable` from @dnd-kit/sortable returns `listeners` (mouse/touch
 *   events) and a stable ref. By default those listeners attach to the
 *   whole sortable element, which means clicking ANYWHERE inside an item
 *   starts a drag — including inside input fields. That's hostile to a
 *   form editor.
 *
 *   Splitting the handle out lets us pass `listeners` to just this small
 *   button. The rest of the item stays free for normal interactions.
 *   Pattern: section/item form wraps content with the sortable ref+style,
 *   places <SortableHandle ... /> in its header, drag works only there.
 *
 * Accessibility:
 *   The handle is a real `<button>` so it's tab-focusable and Enter-
 *   activates dnd-kit's keyboard sensor (defined in SortableList). The
 *   icon is aria-hidden; the visible label "Drag to reorder" is read by
 *   screen readers via the button's aria-label.
 */
import type { DraggableSyntheticListeners } from '@dnd-kit/core';

interface SortableHandleProps {
  listeners: DraggableSyntheticListeners;
  /** True if drag is disabled (e.g., the singleton Header section). */
  disabled?: boolean;
  /** A11y label that describes what dragging this handle reorders. */
  label?: string;
}

export function SortableHandle({
  listeners,
  disabled = false,
  label = 'Drag to reorder',
}: SortableHandleProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Spread listeners ONLY when not disabled — passing them on a disabled
      // button is harmless but the cursor + visual cue should match.
      {...(disabled ? {} : listeners)}
      disabled={disabled}
      className={[
        'inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted',
        disabled
          ? 'opacity-30'
          : 'cursor-grab hover:bg-surface-2 hover:text-ink active:cursor-grabbing',
      ].join(' ')}
    >
      {/* Six-dot drag glyph — neutral and well-recognised. */}
      <span aria-hidden="true" className="text-base leading-none">
        ⋮⋮
      </span>
    </button>
  );
}
