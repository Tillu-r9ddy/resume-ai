/**
 * ExperienceSectionForm — editor form for an Experience section.
 *
 * Shape: `{ items: ExperienceItem[] }` where each item has company, title,
 * location, start, end (null = "Present"), and a nested bullets[] array.
 *
 * This is the richest section form — Education / Skills / Projects are
 * variations on its pattern. Read this one first; the others are skimmable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two field arrays, one form
 * ─────────────────────────────────────────────────────────────────────────────
 *   useFieldArray over `items` is at the section level. BulletsFieldArray
 *   (used inside each job) does the same trick one level deeper, on the
 *   `items.${i}.bullets` path. RHF handles nested field arrays out of the
 *   box; the only thing you have to manage is keying each level on
 *   `field.id` instead of array index.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Sync rules — the easy-to-get-wrong part
 * ─────────────────────────────────────────────────────────────────────────────
 *   • Per-field onBlur dispatches updateItem + markPendingSelfUpdate so the
 *     bounceback reset is skipped (form keeps focus and dirty state).
 *   • Add/remove ITEM (not field) dispatches addItem/removeItem *without*
 *     markPendingSelfUpdate — we WANT the sync useEffect to re-run reset,
 *     because the items array structure changed and RHF's useFieldArray
 *     needs to pick up the new ids.
 *   • storeValue MUST be referentially stable when nothing changed. Hence
 *     the useMemo wrapper below; rebuilding `{ items }` each render would
 *     trigger form.reset constantly.
 */
import { useCallback, useMemo } from 'react';
import { useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExperienceItemSchema, type ExperienceItem } from '../../../schema/resume';
import { useAppDispatch } from '../../../store/hooks';
import { addItem, removeItem, updateItem } from '../../../store/resumeSlice';
import { useReduxBoundForm } from '../../../hooks/useReduxBoundForm';
import { Field } from '../Field';
import { ItemCard } from '../ItemCard';
import { BulletsFieldArray } from '../BulletsFieldArray';

const ExperienceFormSchema = z.object({
  items: z.array(ExperienceItemSchema),
});
type ExperienceFormValues = z.infer<typeof ExperienceFormSchema>;

interface ExperienceSectionFormProps {
  sectionId: string;
  items: ExperienceItem[];
}

export function ExperienceSectionForm({
  sectionId,
  items,
}: ExperienceSectionFormProps): React.JSX.Element {
  const dispatch = useAppDispatch();

  // Memoise the wrapper so storeValue is referentially stable when items
  // hasn't changed. Without this, every parent re-render produces a fresh
  // `{ items }` object, the sync useEffect's dep array changes, and
  // form.reset stomps the user's in-progress edit.
  const storeValue = useMemo<ExperienceFormValues>(() => ({ items }), [items]);

  const { form, markPendingSelfUpdate } = useReduxBoundForm<ExperienceFormValues>({
    resolver: zodResolver(ExperienceFormSchema),
    storeValue,
    mode: 'onBlur',
  });

  const { register, control, formState } = form;
  const { fields } = useFieldArray<ExperienceFormValues, 'items'>({
    control,
    name: 'items',
  });
  const errors = formState.errors;

  const commitItemField = useCallback(
    (itemId: string, name: keyof ExperienceItem, index: number) => () => {
      markPendingSelfUpdate();
      dispatch(
        updateItem({
          sectionId,
          itemId,
          patch: {
            [name]: form.getValues(`items.${index}.${name}` as const),
          } as Partial<ExperienceItem>,
        }),
      );
    },
    [dispatch, sectionId, form, markPendingSelfUpdate],
  );

  /**
   * For the nested bullets array we commit the WHOLE bullets array on
   * each add/remove/edit. That's both correct (RHF's getValues reflects
   * the latest) and produces sensible undo entries ("bullets changed").
   */
  const commitBullets = useCallback(
    (itemId: string, index: number) => () => {
      markPendingSelfUpdate();
      dispatch(
        updateItem({
          sectionId,
          itemId,
          patch: { bullets: form.getValues(`items.${index}.bullets`) },
        }),
      );
    },
    [dispatch, sectionId, form, markPendingSelfUpdate],
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      {fields.length === 0 ? (
        <p className="text-sm text-ink-muted">No jobs yet — click “+ Add job” to start.</p>
      ) : (
        fields.map((field, index) => {
          const itemId = items[index]?.id ?? field.id;
          const itemErrors = errors.items?.[index];
          const isCurrent = form.getValues(`items.${index}.end`) === null;
          return (
            <ItemCard
              key={field.id}
              title={`Job ${index + 1}`}
              badge={isCurrent ? 'current' : undefined}
              onRemove={() => dispatch(removeItem({ sectionId, itemId }))}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Company"
                  registration={register(`items.${index}.company`, {
                    onBlur: commitItemField(itemId, 'company', index),
                  })}
                  error={itemErrors?.company}
                  placeholder="Analytical Engine Ltd"
                />
                <Field
                  label="Title"
                  registration={register(`items.${index}.title`, {
                    onBlur: commitItemField(itemId, 'title', index),
                  })}
                  error={itemErrors?.title}
                  placeholder="Lead Programmer"
                />
              </div>
              <Field
                label="Location"
                registration={register(`items.${index}.location`, {
                  onBlur: commitItemField(itemId, 'location', index),
                })}
                error={itemErrors?.location}
                placeholder="London, UK"
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Start (YYYY-MM)"
                  registration={register(`items.${index}.start`, {
                    onBlur: commitItemField(itemId, 'start', index),
                  })}
                  error={itemErrors?.start}
                  placeholder="2024-01"
                />
                <Field
                  label="End (YYYY-MM, blank = present)"
                  registration={register(`items.${index}.end`, {
                    onBlur: () => {
                      // Treat empty string as the "Present" sentinel (null).
                      const raw = form.getValues(`items.${index}.end`);
                      const next: ExperienceItem['end'] = raw === '' || raw === null ? null : raw;
                      markPendingSelfUpdate();
                      dispatch(
                        updateItem({
                          sectionId,
                          itemId,
                          patch: { end: next },
                        }),
                      );
                    },
                  })}
                  error={itemErrors?.end}
                  placeholder="2025-06"
                />
              </div>

              <BulletsFieldArray<ExperienceFormValues>
                control={control}
                register={register}
                errors={errors}
                name={`items.${index}.bullets`}
                label="Bullets"
                placeholder="Wrote the first algorithm intended to be processed by a machine."
                onCommit={commitBullets(itemId, index)}
              />
            </ItemCard>
          );
        })
      )}

      <button
        type="button"
        // No markPendingSelfUpdate — we WANT the sync effect to fire so
        // RHF picks up the newly-added item with the store-generated id.
        onClick={() => dispatch(addItem({ sectionId }))}
        className="self-start rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
      >
        + Add job
      </button>
    </form>
  );
}
