/**
 * Print — Phase 7: a dedicated, chrome-free route that auto-fires
 * `window.print()`. The browser's print dialog can save to PDF on every
 * desktop platform (Chromium, Firefox, Safari, Edge), so this gets us
 * "Download PDF" without shipping a PDF rendering library.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a separate route instead of `@media print` CSS on the editor?
 * ─────────────────────────────────────────────────────────────────────────────
 *   The print CSS path means writing `display: none` rules for every editor
 *   element so only the preview survives. That's brittle — every new toolbar
 *   button needs another rule. A dedicated route renders ONLY the preview, no
 *   defensive CSS required. Equally important: the user lands on a real URL
 *   they can refresh, bookmark, or share for a clean print snapshot.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why mount outside Shell?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Shell renders the sidebar + main padding. For print we want a bare body
 *   with our page padding controlled by the print CSS (`@page`). Sibling
 *   route in router.tsx — see the order there.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why auto-print on mount?
 * ─────────────────────────────────────────────────────────────────────────────
 *   The user clicked "Download PDF" — they want the print dialog now, not a
 *   second click. We fire on the next microtask (queueMicrotask) so React has
 *   painted the preview before the browser snapshots it. After the dialog
 *   closes (cancel OR save), `afterprint` fires and we navigate back to the
 *   editor — the user never sits on a dead "Print" page.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Preview } from '../components/preview/Preview';

export default function Print(): React.JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    // queueMicrotask defers past the current render so the Preview is in the
    // DOM when the print dialog snapshots it. `setTimeout(0)` would also work
    // but adds a visible flicker on slower machines.
    const fire = (): void => {
      queueMicrotask(() => window.print());
    };

    // `afterprint` runs whether the user saved or cancelled — both cases
    // mean "we're done with this page".
    const handleAfter = (): void => {
      void navigate('/editor', { replace: true });
    };

    window.addEventListener('afterprint', handleAfter);
    fire();

    return () => {
      window.removeEventListener('afterprint', handleAfter);
    };
  }, [navigate]);

  return (
    <main id="print-root" className="mx-auto max-w-[8.5in] bg-canvas px-8 py-10 text-ink">
      <Preview />
      {/*
       * Screen-only fallback so the user sees something useful if they land
       * here directly (e.g. the print dialog never opens because a browser
       * extension blocks it). Hidden from print via the .screen-only class
       * defined in index.css.
       */}
      <div className="screen-only mt-8 rounded-md border border-border bg-surface p-4 text-sm text-ink-muted">
        <p>
          Use your browser's print dialog to save this resume as PDF. Close the dialog to return to
          the editor.
        </p>
      </div>
    </main>
  );
}
