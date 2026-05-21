/**
 * SortableList — generic dnd-kit wrapper for vertically-sortable lists.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why dnd-kit (and not react-beautiful-dnd / react-dnd / a hand-roll)?
 * ─────────────────────────────────────────────────────────────────────────────
 *   • react-beautiful-dnd is unmaintained (Atlassian archived the repo in 2024).
 *     Modern React 18+ apps using StrictMode break it visually in dev.
 *   • react-dnd is a lower-level toolkit; great for trees/graphs, overkill
 *     for a flat sortable list and notoriously verbose.
 *   • dnd-kit ships:
 *       - <DndContext> + <SortableContext>: declarative containers
 *       - Built-in sensors for pointer/touch/KEYBOARD (huge a11y win)
 *       - Modifiers for axis-restriction, snap-to-grid, etc.
 *       - ~10 KB core + 6 KB sortable, tree-shakeable
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What this component does
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Wraps children in <DndContext> with pointer + keyboard sensors.
 *   2. Wraps the inner items in <SortableContext> using verticalListSortingStrategy.
 *   3. On drop, computes the new order of ids and calls `onReorder(newIds)`.
 *   4. Renders each item via a render prop that receives the sortable
 *      bindings (refs + listeners + style) — so the caller plugs them into
 *      its own card markup and gives the drag handle to <SortableHandle>.
 *
 * The render-prop shape is what lets the same SortableList drive both
 * section reordering (in EditorLayout) and item reordering (inside section
 * forms) without templating on the visual shape.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Keyboard a11y for free
 * ─────────────────────────────────────────────────────────────────────────────
 *   KeyboardSensor + sortableKeyboardCoordinates gives us:
 *     • Tab to a SortableHandle
 *     • Space/Enter to "pick up" the item
 *     • Arrow keys to move
 *     • Space/Enter to drop
 *     • Esc to cancel
 *   Screen readers announce position changes via dnd-kit's
 *   `accessibility` API (default messages are reasonable; we'll customise
 *   in 4d.+ if user testing flags issues).
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, ReactNode } from 'react';

/**
 * What the render prop receives for each item.
 *   • setNodeRef + style: spread onto the root element of the item's UI
 *   • listeners: hand to <SortableHandle listeners={...} /> in the header
 *   • isDragging: optional — apply visual feedback (opacity, shadow) on lift
 */
export interface SortableRenderProps {
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
}

interface SortableListProps<T extends { id: string }> {
  items: T[];
  /** Called with the new array of ids when a drop reorders the list. */
  onReorder: (newIds: string[]) => void;
  /** Render one item. Use the bindings to wire dnd-kit into your markup. */
  renderItem: (item: T, bindings: SortableRenderProps) => ReactNode;
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>): React.JSX.Element {
  const sensors = useSensors(
    // Activate only after the pointer moves a few px — prevents accidental
    // drags when the user just wants to click into an input field.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = items.slice();
    const [moved] = next.splice(oldIndex, 1);
    if (!moved) return;
    next.splice(newIndex, 0, moved);
    onReorder(next.map((i) => i.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            {(bindings) => renderItem(item, bindings)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Thin wrapper that calls useSortable for one item and hands the bindings
 * to the render prop. Lives in this file because it's an implementation
 * detail of SortableList — not part of the public API.
 */
function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (bindings: SortableRenderProps) => ReactNode;
}): React.JSX.Element {
  const { setNodeRef, transform, transition, listeners, isDragging } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged item visually: slight elevation, dim everything else
    // via reduced opacity. Cheap visual feedback that needs no extra DOM.
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return <>{children({ setNodeRef, style, listeners, isDragging })}</>;
}
