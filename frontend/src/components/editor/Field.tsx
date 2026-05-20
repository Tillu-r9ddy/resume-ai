/**
 * Field — small presentational wrapper around a form input.
 *
 * Why a wrapper instead of inlining `<label>` + `<input>` everywhere?
 *   • Consistent layout — label, input, optional hint, error in the same
 *     vertical rhythm across every section form.
 *   • Single place to evolve a11y wiring (label↔input id pairing,
 *     aria-invalid, aria-describedby for the error message).
 *   • Zero state of its own — Field is dumb. The parent owns the form,
 *     passes register output and the field's error. That makes Field
 *     trivially reusable across HeaderForm, ExperienceForm, etc.
 *
 * Why accept React Hook Form's `register` output as a prop spread?
 *   `register('name', options)` returns `{ name, onChange, onBlur, ref }`.
 *   Spreading them onto the input makes Field RHF-aware without it
 *   knowing about RHF. If we ever swap RHF for another library, only
 *   the parent components change — Field stays exactly as written.
 */
import type { InputHTMLAttributes, ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  label: string;
  /** Optional helper text shown below the input when there's no error. */
  hint?: string;
  /** RHF field-error from `formState.errors[name]`. Undefined = no error. */
  error?: { message?: string } | undefined;
  /** Return value of `register('name', {...})`. */
  registration: UseFormRegisterReturn;
  /** Optional right-aligned slot (e.g., character counter). */
  rightSlot?: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  registration,
  rightSlot,
  ...inputProps
}: FieldProps): React.JSX.Element {
  const inputId = `field-${registration.name}`;
  const hasError = Boolean(error?.message);
  const describedById = hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
          {label}
        </label>
        {rightSlot}
      </div>
      <input
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={describedById}
        className={[
          'rounded-md border bg-surface px-3 py-2 text-sm text-ink',
          'placeholder:text-ink-muted/60 focus:outline-none focus:ring-2',
          hasError
            ? 'border-red-500/60 focus:ring-red-500/40'
            : 'border-border focus:border-accent focus:ring-accent/30',
        ].join(' ')}
        {...registration}
        {...inputProps}
      />
      {hasError ? (
        <p id={`${inputId}-error`} className="text-xs text-red-300">
          {error?.message}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
