/**
 * LinksFieldArray — manages header.links[] inside HeaderForm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why `useFieldArray` and not just `useState<Link[]>`?
 * ─────────────────────────────────────────────────────────────────────────────
 *   `useFieldArray` is RHF's primitive for repeating fields. It gives you:
 *     • `fields` — render-friendly array with STABLE keys (`field.id`) that
 *       React can reconcile even when entries move (drag-to-reorder later)
 *     • `append`, `remove`, `move`, `swap` — mutators that integrate with
 *       RHF's dirty/touched/error tracking
 *     • Validation per row via the same Zod schema attached to the parent
 *       useForm
 *
 *   Rolling this with useState means losing all of the above and writing
 *   your own dirty/error book-keeping. Don't.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why the `key={field.id}` and not `key={index}`?
 * ─────────────────────────────────────────────────────────────────────────────
 *   `field.id` is generated once when the row enters the field array. It
 *   stays stable across reorders. Using the array index as a key means
 *   React thinks "row 2 changed" when really you swapped two rows — the
 *   inputs lose focus, validation flickers, controlled state desyncs.
 *   This is THE classic React-list bug; `useFieldArray` exists in part to
 *   prevent it.
 *
 *   Note that `field.id` is RHF's internal id, not our Zod-schema `id`
 *   field. We have both because RHF can't assume our entities carry ids,
 *   so it makes its own.
 */
import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from 'react-hook-form';
import type { Header } from '../../schema/resume';
import { Field } from './Field';

interface LinksFieldArrayProps {
  control: Control<Header>;
  register: UseFormRegister<Header>;
  errors: FieldErrors<Header>;
  /** Called when any link field blurs — parent uses this to dispatch updateHeader. */
  onCommit: () => void;
}

export function LinksFieldArray({
  control,
  register,
  errors,
  onCommit,
}: LinksFieldArrayProps): React.JSX.Element {
  const { fields, append, remove } = useFieldArray<Header, 'links'>({
    control,
    name: 'links',
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-muted">Links</span>
        <button
          type="button"
          onClick={() => {
            append({ label: '', url: '' });
            onCommit();
          }}
          className="text-xs font-medium text-accent hover:underline"
        >
          + Add link
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-ink-muted">No links yet — click “+ Add link”.</p>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <Field
              label={`Link ${index + 1} · label`}
              registration={register(`links.${index}.label`, { onBlur: onCommit })}
              error={errors.links?.[index]?.label}
              placeholder="GitHub"
            />
            <Field
              label="URL"
              registration={register(`links.${index}.url`, { onBlur: onCommit })}
              error={errors.links?.[index]?.url}
              placeholder="https://github.com/you"
              type="url"
            />
            <button
              type="button"
              onClick={() => {
                remove(index);
                onCommit();
              }}
              aria-label={`Remove link ${index + 1}`}
              className="mt-5 inline-flex h-9 w-9 items-center justify-center self-start rounded-md border border-border bg-surface-2 text-sm text-ink-muted hover:bg-red-500/10 hover:text-red-300"
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}
