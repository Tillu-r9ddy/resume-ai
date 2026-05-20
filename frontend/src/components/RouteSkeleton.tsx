/**
 * RouteSkeleton — what the user sees while a lazy route chunk downloads.
 *
 * WHY skeletons over spinners?
 *   • Skeletons set a visual expectation of structure → feels faster even when
 *     network time is identical (lots of research on "perceived performance").
 *   • Spinners imply "indeterminate wait"; skeletons imply "content is coming".
 *   • Skeletons reduce CLS (Cumulative Layout Shift) by reserving space — the
 *     page doesn't jump when real content arrives.
 *
 * Keep skeletons coarse. Don't try to mirror the exact final layout — that
 * couples the skeleton to the page and breaks the moment the page changes.
 */
export function RouteSkeleton(): React.JSX.Element {
  return (
    <div className="max-w-3xl animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-7 w-1/3 rounded-md bg-surface-2" />
      <div className="mt-3 h-4 w-2/3 rounded-md bg-surface-2" />
      <div className="mt-10 h-40 rounded-xl border border-border bg-surface" />
    </div>
  );
}
