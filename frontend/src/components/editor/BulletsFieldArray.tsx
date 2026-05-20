/**
 * BulletsFieldArray — `useFieldArray` over a `string[]` field.
 *
 * Used by Experience.items[i].bullets and Projects.items[i].bullets. Could
 * also be repurposed for any "list of plain strings" field — Skills uses a
 * very similar variant inline.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a string-array deserves its own component
 * ─────────────────────────────────────────────────────────────────────────────
 *   RHF's useFieldArray generates a synthetic `id` for each row regardless
 *   of whether the underlying value is an object or a primitive. The
 *   `field.id` is what you key on for React reconciliation — using array
 *   index as the key here would cause the classic "row 2 swapped with row 1
 *   → both lose focus" bug. The component is small but the lesson is
 *   important enough to keep in one place.
 *
 *   The trick that makes this work despite `bullets` being a `string[]` and
 *   not a `{ id, text }[]`: you register the field by index
 *   (`register(\`...bullets.${i}\`)`), and `field.id` from useFieldArray is
 *   used purely as the React key. RHF doesn't actually need the underlying
 *   value to be an object — it just needs SOMETHING with a stable id to map
 *   across renders, and it manufactures one for you.
 *
 * Path pattern:
 *   `${parentPath}.${index}` — e.g. `items.0.bullets.3`
 */
import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type FieldErrors,
  type FieldValues,
  type ArrayPath,
  type Path,
} from 'react-hook-form';
import type { Header } from '../../schema/resume';

/**
 * `name` is typed as plain `string` rather than `ArrayPath<T>`.
 *
 * Why relax the type?
 *   RHF's `ArrayPath<T>` helper only resolves top-level array fields cleanly.
 *   It struggles with arrays-nested-inside-arrays (TS depth limits + the
 *   helper's structure) — e.g., `items.${number}.bullets` doesn't satisfy
 *   `ArrayPath<{items: ExperienceItem[]}>` even though it IS an array path
 *   at runtime. Forcing `ArrayPath<T>` at the call site means casting at
 *   every use; widening to `string` here pushes the trade-off into one
 *   place (this file) with a comment, and RHF still validates the path at
 *   runtime when you call `register` / `useFieldArray`.
 */
interface BulletsFieldArrayProps<T extends FieldValues> {
  control: Control<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  name: string;
  /** Called on every blur / add / remove so the parent can commit to the store. */
  onCommit: () => void;
  /** Inline label shown above the rows. */
  label?: string;
  placeholder?: string;
}

export function BulletsFieldArray<T extends FieldValues>({
  control,
  register,
  errors,
  name,
  onCommit,
  label = 'Bullets',
  placeholder = 'Led migration of …, reduced p99 latency by 40%',
}: BulletsFieldArrayProps<T>): React.JSX.Element {
  const { fields, append, remove } = useFieldArray<T>({
    control,
    name: name as ArrayPath<T>,
  });

  /**
   * RHF's nested `errors` for `items.0.bullets.3` is reachable via dotted
   * notation but typing it requires re-walking the path. For 4c we render a
   * generic per-row error placeholder; deep error wiring is a 4d polish.
   * Suppressed-unused warning: we accept the prop for API completeness.
   */
  void errors;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <button
          type="button"
          onClick={() => {
            // RHF's append takes either a value or an array of values. For
            // primitive arrays you pass the string directly; TS infers it.
            append('' as never);
            onCommit();
          }}
          className="text-xs font-medium text-accent hover:underline"
        >
          + Add bullet
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-ink-muted">No bullets yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <li key={field.id} className="grid grid-cols-[1fr_auto] gap-2">
              <input
                {...register(`${name}.${index}` as Path<T>, { onBlur: onCommit })}
                placeholder={placeholder}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="button"
                onClick={() => {
                  remove(index);
                  onCommit();
                }}
                aria-label={`Remove bullet ${index + 1}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2 text-sm text-ink-muted hover:bg-red-500/10 hover:text-red-300"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Convenience type re-export so section forms don't have to import RHF
 * helper types directly when they want to type a Control for the wider
 * schema. Header isn't used here but exporting from this module keeps the
 * Control typing concerns colocated with the field-array component.
 */
export type { Header };
