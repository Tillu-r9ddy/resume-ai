/**
 * EducationSectionForm — Phase 4c's simplest section form. Flat items, no
 * nested arrays. Mirror this when you want to know the bare minimum
 * useFieldArray section pattern looks like.
 */
import { useCallback, useMemo } from 'react';
import { useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EducationItemSchema, type EducationItem } from '../../../schema/resume';
import { useAppDispatch } from '../../../store/hooks';
import { addItem, removeItem, reorderItems, updateItem } from '../../../store/resumeSlice';
import { useReduxBoundForm } from '../../../hooks/useReduxBoundForm';
import { Field } from '../Field';
import { ItemCard } from '../ItemCard';
import { SortableList } from '../SortableList';

const EducationFormSchema = z.object({
  items: z.array(EducationItemSchema),
});
type EducationFormValues = z.infer<typeof EducationFormSchema>;

interface EducationSectionFormProps {
  sectionId: string;
  items: EducationItem[];
}

export function EducationSectionForm({
  sectionId,
  items,
}: EducationSectionFormProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const storeValue = useMemo<EducationFormValues>(() => ({ items }), [items]);

  const { form, markPendingSelfUpdate } = useReduxBoundForm<EducationFormValues>({
    resolver: zodResolver(EducationFormSchema),
    storeValue,
    mode: 'onBlur',
  });

  const { register, control, formState } = form;
  const { fields } = useFieldArray<EducationFormValues, 'items'>({
    control,
    name: 'items',
  });
  const errors = formState.errors;

  const commitItemField = useCallback(
    (itemId: string, name: keyof EducationItem, index: number) => () => {
      markPendingSelfUpdate();
      dispatch(
        updateItem({
          sectionId,
          itemId,
          patch: {
            [name]: form.getValues(`items.${index}.${name}` as const),
          } as Partial<EducationItem>,
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
        <p className="text-sm text-ink-muted">No education entries yet — click “+ Add school”.</p>
      ) : (
        <SortableList
          items={items}
          onReorder={(itemIds) => dispatch(reorderItems({ sectionId, itemIds }))}
          renderItem={(item, bindings) => {
            const index = items.findIndex((it) => it.id === item.id);
            if (index < 0) return null;
            const itemId = item.id;
            const itemErrors = errors.items?.[index];
            return (
              <ItemCard
                title={`School ${index + 1}`}
                onRemove={() => dispatch(removeItem({ sectionId, itemId }))}
                bindings={bindings}
              >
                <Field
                  label="School"
                  registration={register(`items.${index}.school`, {
                    onBlur: commitItemField(itemId, 'school', index),
                  })}
                  error={itemErrors?.school}
                  placeholder="Imperial College London"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Degree"
                    registration={register(`items.${index}.degree`, {
                      onBlur: commitItemField(itemId, 'degree', index),
                    })}
                    error={itemErrors?.degree}
                    placeholder="B.Sc."
                  />
                  <Field
                    label="Field of study"
                    registration={register(`items.${index}.field`, {
                      onBlur: commitItemField(itemId, 'field', index),
                    })}
                    error={itemErrors?.field}
                    placeholder="Computer Science"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field
                    label="Start (YYYY-MM)"
                    registration={register(`items.${index}.start`, {
                      onBlur: commitItemField(itemId, 'start', index),
                    })}
                    error={itemErrors?.start}
                    placeholder="2020-09"
                  />
                  <Field
                    label="End (YYYY-MM)"
                    registration={register(`items.${index}.end`, {
                      onBlur: () => {
                        const raw = form.getValues(`items.${index}.end`);
                        const next: EducationItem['end'] = raw === '' || raw === null ? null : raw;
                        markPendingSelfUpdate();
                        dispatch(updateItem({ sectionId, itemId, patch: { end: next } }));
                      },
                    })}
                    error={itemErrors?.end}
                    placeholder="2024-06"
                  />
                  <Field
                    label="GPA (optional)"
                    registration={register(`items.${index}.gpa`, {
                      onBlur: commitItemField(itemId, 'gpa', index),
                    })}
                    error={itemErrors?.gpa}
                    placeholder="3.9 / 4.0"
                  />
                </div>
              </ItemCard>
            );
          }}
        />
      )}

      <button
        type="button"
        onClick={() => dispatch(addItem({ sectionId }))}
        className="self-start rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
      >
        + Add school
      </button>
    </form>
  );
}
