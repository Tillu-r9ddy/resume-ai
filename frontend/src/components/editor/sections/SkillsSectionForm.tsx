/**
 * SkillsSectionForm — section form for skill groups.
 *
 * Shape: `items: [{ id, group, items: string[] }]` — each "item" is a named
 * group (e.g., "Languages") with an inner array of skill strings (e.g.,
 * ["TypeScript", "Python", "Go"]).
 *
 * Re-uses BulletsFieldArray verbatim — it's just "useFieldArray over a
 * string[]" under a different label. The 4d split into a dedicated
 * `StringArrayFieldArray` is debatable; for now the bullets component is
 * generic enough.
 */
import { useCallback, useMemo } from 'react';
import { useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SkillsItemSchema, type SkillsItem } from '../../../schema/resume';
import { useAppDispatch } from '../../../store/hooks';
import { addItem, removeItem, updateItem } from '../../../store/resumeSlice';
import { useReduxBoundForm } from '../../../hooks/useReduxBoundForm';
import { Field } from '../Field';
import { ItemCard } from '../ItemCard';
import { BulletsFieldArray } from '../BulletsFieldArray';

const SkillsFormSchema = z.object({
  items: z.array(SkillsItemSchema),
});
type SkillsFormValues = z.infer<typeof SkillsFormSchema>;

interface SkillsSectionFormProps {
  sectionId: string;
  items: SkillsItem[];
}

export function SkillsSectionForm({ sectionId, items }: SkillsSectionFormProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const storeValue = useMemo<SkillsFormValues>(() => ({ items }), [items]);

  const { form, markPendingSelfUpdate } = useReduxBoundForm<SkillsFormValues>({
    resolver: zodResolver(SkillsFormSchema),
    storeValue,
    mode: 'onBlur',
  });

  const { register, control, formState } = form;
  const { fields } = useFieldArray<SkillsFormValues, 'items'>({
    control,
    name: 'items',
  });
  const errors = formState.errors;

  const commitItemField = useCallback(
    (itemId: string, name: keyof SkillsItem, index: number) => () => {
      markPendingSelfUpdate();
      dispatch(
        updateItem({
          sectionId,
          itemId,
          patch: {
            [name]: form.getValues(`items.${index}.${name}` as const),
          } as Partial<SkillsItem>,
        }),
      );
    },
    [dispatch, sectionId, form, markPendingSelfUpdate],
  );

  const commitItems = useCallback(
    (itemId: string, index: number) => () => {
      markPendingSelfUpdate();
      dispatch(
        updateItem({
          sectionId,
          itemId,
          patch: { items: form.getValues(`items.${index}.items`) },
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
        <p className="text-sm text-ink-muted">No skill groups yet — click “+ Add group”.</p>
      ) : (
        fields.map((field, index) => {
          const itemId = items[index]?.id ?? field.id;
          const itemErrors = errors.items?.[index];
          return (
            <ItemCard
              key={field.id}
              title={`Group ${index + 1}`}
              onRemove={() => dispatch(removeItem({ sectionId, itemId }))}
            >
              <Field
                label="Group name"
                registration={register(`items.${index}.group`, {
                  onBlur: commitItemField(itemId, 'group', index),
                })}
                error={itemErrors?.group}
                placeholder="Languages · Frameworks · Tools"
              />
              <BulletsFieldArray<SkillsFormValues>
                control={control}
                register={register}
                errors={errors}
                name={`items.${index}.items`}
                label="Skills"
                placeholder="TypeScript"
                onCommit={commitItems(itemId, index)}
              />
            </ItemCard>
          );
        })
      )}

      <button
        type="button"
        onClick={() => dispatch(addItem({ sectionId }))}
        className="self-start rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent hover:text-canvas"
      >
        + Add group
      </button>
    </form>
  );
}
