/**
 * ProjectsSectionForm — almost identical to Experience minus dates, plus
 * an optional URL field. Compare to ExperienceSectionForm to see how
 * little the section-form pattern varies once the bones are in place.
 */
import { useCallback, useMemo } from 'react';
import { useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProjectItemSchema, type ProjectItem } from '../../../schema/resume';
import { useAppDispatch } from '../../../store/hooks';
import { addItem, removeItem, reorderItems, updateItem } from '../../../store/resumeSlice';
import { useReduxBoundForm } from '../../../hooks/useReduxBoundForm';
import { Field } from '../Field';
import { ItemCard } from '../ItemCard';
import { BulletsFieldArray } from '../BulletsFieldArray';
import { SortableList } from '../SortableList';

const ProjectsFormSchema = z.object({
  items: z.array(ProjectItemSchema),
});
type ProjectsFormValues = z.infer<typeof ProjectsFormSchema>;

interface ProjectsSectionFormProps {
  sectionId: string;
  items: ProjectItem[];
}

export function ProjectsSectionForm({
  sectionId,
  items,
}: ProjectsSectionFormProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const storeValue = useMemo<ProjectsFormValues>(() => ({ items }), [items]);

  const { form, markPendingSelfUpdate } = useReduxBoundForm<ProjectsFormValues>({
    resolver: zodResolver(ProjectsFormSchema),
    storeValue,
    mode: 'onBlur',
  });

  const { register, control, formState } = form;
  const { fields } = useFieldArray<ProjectsFormValues, 'items'>({
    control,
    name: 'items',
  });
  const errors = formState.errors;

  const commitItemField = useCallback(
    (itemId: string, name: keyof ProjectItem, index: number) => () => {
      markPendingSelfUpdate();
      dispatch(
        updateItem({
          sectionId,
          itemId,
          patch: {
            [name]: form.getValues(`items.${index}.${name}` as const),
          } as Partial<ProjectItem>,
        }),
      );
    },
    [dispatch, sectionId, form, markPendingSelfUpdate],
  );

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
        <p className="text-sm text-ink-muted">No projects yet — click “+ Add project”.</p>
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
                title={`Project ${index + 1}`}
                onRemove={() => dispatch(removeItem({ sectionId, itemId }))}
                bindings={bindings}
              >
                <Field
                  label="Name"
                  registration={register(`items.${index}.name`, {
                    onBlur: commitItemField(itemId, 'name', index),
                  })}
                  error={itemErrors?.name}
                  placeholder="Resume-AI"
                />
                <Field
                  label="Summary"
                  registration={register(`items.${index}.summary`, {
                    onBlur: commitItemField(itemId, 'summary', index),
                  })}
                  error={itemErrors?.summary}
                  placeholder="One-line description of what it does and why it matters."
                />
                <Field
                  label="Link (optional)"
                  registration={register(`items.${index}.link`, {
                    onBlur: commitItemField(itemId, 'link', index),
                  })}
                  error={itemErrors?.link}
                  placeholder="https://github.com/you/resume-ai"
                  type="url"
                />
                <BulletsFieldArray<ProjectsFormValues>
                  control={control}
                  register={register}
                  errors={errors}
                  name={`items.${index}.bullets`}
                  label="Bullets"
                  placeholder="Shipped Phase 4 in a weekend."
                  onCommit={commitBullets(itemId, index)}
                />
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
        + Add project
      </button>
    </form>
  );
}
