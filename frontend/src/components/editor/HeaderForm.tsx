/**
 * HeaderForm — RHF-bound editor for the singleton Header section.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why React Hook Form (not Formik, not controlled-component DIY)?
 * ─────────────────────────────────────────────────────────────────────────────
 *   • RHF is *uncontrolled-first* — it registers each input via a ref instead
 *     of mirroring every keystroke into React state. Result: typing a letter
 *     re-renders only the field's error message (if validation runs), not
 *     the whole form. Formik is controlled and re-renders on every keystroke;
 *     at 50+ fields that's noticeable lag.
 *   • zodResolver wires the same Zod schemas we already wrote to the form
 *     so validation is single-source-of-truth. No duplicate yup/yup-like
 *     schemas to maintain.
 *   • Built-in `useFieldArray` for repeating items (next door: links).
 *   • Negligible bundle (~25 KB before tree-shake).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Bidirectional sync — the *only* tricky part of integrating RHF with Redux
 * ─────────────────────────────────────────────────────────────────────────────
 *   Direction 1 (form → store): on every field's onBlur, dispatch the latest
 *   field value via `updateHeader`. One blur = one action = one undo entry.
 *
 *   Direction 2 (store → form): when the store changes from OUTSIDE the form
 *   (clicking Undo, Redo, or "Reset to seed"), we have to push that change
 *   back into RHF so the inputs show the new values.
 *
 *   The gotcha: our own onBlur dispatch *also* changes the store. If we
 *   naively `form.reset(header)` whenever the store header changes, we'd
 *   reset right after every blur — losing focus, clearing dirty state, etc.
 *
 *   The fix: a `skipNextSync` ref. Before dispatching, set it to true. The
 *   useEffect checks the ref and skips the reset that immediately follows
 *   our own dispatch. Undo/redo don't set the flag, so their store changes
 *   DO sync into the form. Clean.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { HeaderSchema, type Header } from '../../schema/resume';
import { selectHeader } from '../../store/selectors';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateHeader } from '../../store/resumeSlice';
import { useReduxBoundForm } from '../../hooks/useReduxBoundForm';
import { Field } from './Field';
import { LinksFieldArray } from './LinksFieldArray';

export function HeaderForm(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const header = useAppSelector(selectHeader);

  if (!header) {
    return (
      <p className="text-sm text-ink-muted">
        No header section in this resume. Use the debug panel to reset to seed.
      </p>
    );
  }

  return <HeaderFormInner header={header} dispatch={dispatch} />;
}

/**
 * Inner component receives a guaranteed-non-null header. We split the
 * component so the `useForm` hook isn't called conditionally — React's
 * Rules of Hooks forbid that, and TS narrowing inside the parent would
 * still leave the hook call after a possible `return null`.
 */
function HeaderFormInner({
  header,
  dispatch,
}: {
  header: Header;
  dispatch: ReturnType<typeof useAppDispatch>;
}): React.JSX.Element {
  // useReduxBoundForm owns the form + the bidirectional sync trick that
  // used to live inline here. See hooks/useReduxBoundForm.ts for the why.
  const { form, markPendingSelfUpdate } = useReduxBoundForm<Header>({
    resolver: zodResolver(HeaderSchema),
    storeValue: header,
    mode: 'onBlur',
  });

  // ── Direction 1: form → store, scoped to one field's blur ─────────────
  // Returns a handler we attach via register('field', { onBlur }).
  // We dispatch only the field that just blurred, not the whole header —
  // a smaller payload + a more meaningful action in the undo timeline.
  const commitField = (name: keyof Header) => () => {
    markPendingSelfUpdate();
    dispatch(updateHeader({ [name]: form.getValues(name) } as Partial<Header>));
  };

  // For the links field array, label/url blurs aren't on a single named
  // field — we always commit the whole `links` array. Simpler and correct
  // (RHF's getValues('links') reflects the latest add/remove/edit state).
  const commitLinks = (): void => {
    markPendingSelfUpdate();
    dispatch(updateHeader({ links: form.getValues('links') }));
  };

  const { register, control, formState } = form;
  const errors = formState.errors;

  return (
    /*
     * `noValidate` disables the browser's native validation popups so we
     * own the entire error UX. `onSubmit` is a no-op — we never submit;
     * autosave handles everything.
     */
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className="flex flex-col gap-4"
    >
      <Field
        label="Full name"
        registration={register('fullName', { onBlur: commitField('fullName') })}
        error={errors.fullName}
        placeholder="Ada Lovelace"
        autoComplete="name"
      />
      <Field
        label="Headline"
        registration={register('headline', { onBlur: commitField('headline') })}
        error={errors.headline}
        placeholder="Senior Software Engineer · Distributed Systems"
        hint="One line that captures who you are professionally."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Email"
          registration={register('email', { onBlur: commitField('email') })}
          error={errors.email}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
        />
        <Field
          label="Phone"
          registration={register('phone', { onBlur: commitField('phone') })}
          error={errors.phone}
          placeholder="+1 555 0123"
          type="tel"
          autoComplete="tel"
        />
      </div>
      <Field
        label="Location"
        registration={register('location', { onBlur: commitField('location') })}
        error={errors.location}
        placeholder="Brooklyn, NY"
      />

      <LinksFieldArray
        control={control}
        register={register}
        errors={errors}
        onCommit={commitLinks}
      />
    </form>
  );
}
