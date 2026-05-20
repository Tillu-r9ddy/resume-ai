/**
 * useReduxBoundForm — RHF form whose values stay in sync with a Redux slice.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What problem does this solve?
 * ─────────────────────────────────────────────────────────────────────────────
 *   When the editor's source of truth lives in Redux but the UI is built with
 *   React Hook Form, you have to sync two directions:
 *
 *     1. Form → Store: the form dispatches updates (onBlur / onChange / etc.).
 *     2. Store → Form: external store changes (undo, redo, reset, load) have
 *        to push their new values back into the form so the inputs reflect
 *        the latest state.
 *
 *   Direction 2 is the tricky one. If you naïvely `form.reset(storeValue)`
 *   every time the store changes, you'll also reset right after your OWN
 *   dispatches — losing focus, clearing dirty state, re-running validation,
 *   stomping on whatever the user just typed.
 *
 *   The fix is a "skip next sync" flag set BEFORE dispatching. The store→form
 *   useEffect checks the flag, skips one round of `reset()` (that's the
 *   bounceback from our own action), then resumes normal behaviour. Undo/
 *   redo never set the flag, so their store changes DO sync into the form.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why an abstraction?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Header prototyped this pattern inline. With four more section forms
 *   landing in 4c, four-fold duplication of the same useRef + useEffect
 *   would be noisy and a bug magnet (forget to set the ref → focus stomp).
 *
 *   This hook owns the pattern in one place. Each section form calls it
 *   once and gets back:
 *     • `form`: a fully-typed UseFormReturn
 *     • `markPendingSelfUpdate()`: call this RIGHT before dispatching
 *
 *   Failure mode if you forget to call markPendingSelfUpdate: the form
 *   resets after your dispatch and focus jumps. Visible, easy to fix.
 *   Failure mode if you call it but don't dispatch: the next external
 *   change is silently dropped. Slightly worse — so pair them carefully.
 */
import { useEffect, useRef } from 'react';
import { useForm, type FieldValues, type UseFormProps, type UseFormReturn } from 'react-hook-form';

export interface UseReduxBoundFormReturn<T extends FieldValues> {
  form: UseFormReturn<T>;
  /**
   * Call immediately before dispatching a store update from this form.
   * Skips ONE round of the store-to-form sync that would otherwise
   * bounce your own action back through `form.reset()`.
   */
  markPendingSelfUpdate: () => void;
}

export interface UseReduxBoundFormOptions<T extends FieldValues> extends Omit<
  UseFormProps<T>,
  'defaultValues'
> {
  /**
   * Current value from the Redux store. The form mounts with this as
   * `defaultValues` and re-syncs to it whenever it changes from outside.
   *
   * IMPORTANT: this should be a *stable reference* — i.e., come from a
   * memoised selector or directly from a slice. Building a new object
   * each render (`{ foo: state.foo }`) would re-trigger the sync effect
   * every render and reset the form constantly.
   */
  storeValue: T;
}

export function useReduxBoundForm<T extends FieldValues>({
  storeValue,
  ...formOptions
}: UseReduxBoundFormOptions<T>): UseReduxBoundFormReturn<T> {
  const form = useForm<T>({
    ...formOptions,
    defaultValues: storeValue as UseFormProps<T>['defaultValues'],
  });

  /**
   * True between the moment we dispatch and the next render where the
   * store update arrives. The sync useEffect resets this immediately on
   * the bounceback render, so it's never "armed" for more than one tick.
   */
  const pendingSelfUpdateRef = useRef(false);

  useEffect(() => {
    if (pendingSelfUpdateRef.current) {
      pendingSelfUpdateRef.current = false;
      return;
    }
    // External change — push the new values into the form.
    form.reset(storeValue);
  }, [storeValue, form]);

  return {
    form,
    markPendingSelfUpdate: () => {
      pendingSelfUpdateRef.current = true;
    },
  };
}
