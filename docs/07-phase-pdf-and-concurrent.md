# Phase 7 — PDF Export + Concurrent React Polish

> Goal: ship "Download PDF" without taking a runtime dependency on a PDF renderer, and make the Preview pane responsive enough that typing in a long resume never stutters. Two small features, both about making the existing pipeline feel finished.

## What we built and WHY

### 1. `/print` route + `window.print()` — the PDF export

```tsx
useEffect(() => {
  queueMicrotask(() => window.print());
  window.addEventListener('afterprint', () => navigate('/editor', { replace: true }));
}, []);
```

The browser's print dialog can already save to PDF on every desktop platform (Chrome, Firefox, Safari, Edge). We don't need `react-to-print`, `pdfmake`, `jspdf`, or `puppeteer`. We just need a chrome-free route that renders the Preview and triggers the print dialog.

Why a dedicated route and not `@media print` CSS on the Editor?

- A CSS-only solution means writing `display: none` rules for every editor-only element — the form, the sidebar, the toolbar, the debug panel. Every new chrome element needs another rule. Brittle.
- A dedicated route renders **only** the preview, no defensive CSS needed.
- The URL is real — refreshable, shareable, bookmarkable for "print this version".

Why mount `/print` **outside** the Shell? The Shell renders the sidebar and the editor padding. For print we want a bare body with our page margins controlled by `@page`. Sibling-route placement in `router.tsx` is the cleanest way.

Why `queueMicrotask` before `window.print()`? React's commit phase paints synchronously, but the browser hasn't yet painted to screen — and several browsers will snapshot the pre-paint state if you call `print()` from inside the same microtask. `queueMicrotask` defers past the current frame so the Preview is in the DOM when the dialog reads it. `setTimeout(0)` works too but produces a visible flicker on slower machines.

Why navigate back on `afterprint`? `afterprint` fires whether the user saved or cancelled. Either way, sitting on the `/print` page is a dead end — we want them back in the editor. `replace: true` keeps the history clean (no "back to print" button in history).

### 2. `@media print` + `@page` — the print stylesheet

```css
@media print {
  @page {
    size: letter;
    margin: 0.5in;
  }
  :root {
    /* force light palette */
  }
  .screen-only {
    display: none !important;
  }
}
```

- **`size: letter; margin: 0.5in;`** — US Letter is the most common resume format. A4 users still get a usable page (Chrome's print dialog scales to fit by default).
- **Force a light palette in print.** The app's default dark theme would render white-on-black, wasting ink. Override `--color-canvas`, `--color-ink`, etc. unconditionally for the print medium. Users on dark mode get a real white-paper resume.
- **`.screen-only` escape hatch.** Slap it on anything that shouldn't appear on paper (instructional text, fallback nudges). One class instead of a dozen `display: none` rules.

### 3. `useDeferredValue` on Preview — concurrent React polish

```tsx
const liveSections = useAppSelector(selectSections);
const sections = useDeferredValue(liveSections);
const isStale = sections !== liveSections;
```

The setup: typing in a form fires a Redux action → `selectSections` changes → the Preview re-renders the whole tree. On a benchmark resume (~15 jobs, ~10 projects, hundreds of nested nodes), each keystroke does a non-trivial amount of work.

`useDeferredValue` tells React: render the form update at high priority, render the preview update at low priority — and if a newer update arrives mid-render, throw the in-progress preview render away. The form stays instant; the preview catches up a frame or two later.

The `isStale` flag (`sections !== liveSections`) lets us dim the preview while it's behind the form. A subtle UI cue that the preview is "still catching up" without a spinner. `aria-busy={isStale}` gives screen readers the same signal.

This is cheap because the preview components are memoised (Phase 5). Without the memo, deferring would still render the same total work — just spread across more frames. The two optimisations compose multiplicatively.

### 4. "Download PDF" link in the Editor toolbar

Added as a plain `<a href="/print">`, not a button with `window.open`. Reasoning:

- Same-tab navigation lets `window.print()` fire reliably. Many browsers block `print()` on a tab the user didn't navigate to (popup heuristic).
- The Print route navigates back to `/editor` after the dialog closes, so the round-trip is seamless.
- Plain anchor is keyboard-accessible (Enter activates) and right-click-friendly (open in new tab is a legit user workflow).

## Acceptance criteria

- ✅ Clicking "Download PDF" opens the browser print dialog with the resume rendered chrome-free.
- ✅ Saving as PDF produces an A4/Letter-sized document with 0.5in margins.
- ✅ Dark-mode users still get a white-paper PDF.
- ✅ Closing the dialog (save or cancel) returns to `/editor` automatically.
- ✅ Typing fast in a 30-section benchmark resume keeps the form responsive (preview catches up async).
- ✅ Preview visibly dims briefly while it's lagging the form (the `isStale` cue).

## What we deliberately did NOT do

- **`react-to-print` / `puppeteer` / server-side PDF.** All are valid for "send the PDF in an email" workflows. For "let the user download a PDF", the browser's native dialog is free, fast, and battle-tested. Adding a JS PDF library would mean shipping Adobe-grade font handling and pagination logic — Chromium already has both.
- **Multi-page templates / cover letters.** Scope. Today's preview is the resume; that's what we print.
- **Color picker for accent colour in print.** Premature personalisation. The forced palette is consistent and readable; if a user really wants accent colours on paper they can save the PDF and recolor in Acrobat.
- **`useTransition` instead of `useDeferredValue`.** `useTransition` is for **state updates I control**; `useDeferredValue` is for **state I receive**. The Preview receives sections from Redux — useDeferredValue is the right primitive.
- **A separate PDF route that hits the server.** No backend involvement; reduces failure modes; works offline.

## Interview questions Phase 7 prepares you to answer

> **Q:** Why use the browser's print dialog instead of `react-to-print` or a server-side PDF renderer?
> **A:** Three things. Cost — zero new dependencies, no runtime PDF engine to ship. Quality — Chromium's print pipeline already handles fonts, hyphenation, page breaks, headers/footers, and high-DPI images correctly. Maintenance — every browser improvement to print rendering ships for free. The trade-off is we lose programmatic control (we can't, e.g., embed a watermark only on PDF). For a "let the user save the resume" workflow, the trade is overwhelmingly in our favour.

> **Q:** What's the difference between `useDeferredValue` and `useTransition`?
> **A:** They solve the same class of problem (defer expensive updates so urgent ones stay responsive) from different ends. `useTransition` wraps a state update I'm about to dispatch — `startTransition(() => setX(...))`. `useDeferredValue` wraps a value I've received — `useDeferredValue(propOrSelectorResult)`. Use `useTransition` when you own the setter; use `useDeferredValue` when you don't. The Preview reads `selectSections` from Redux; we don't own the dispatch, so `useDeferredValue` is the right tool.

> **Q:** Why does `useDeferredValue` need memoised children to actually help?
> **A:** It tells React "render this with the old value at high priority and the new value at low priority". The "low priority" pass still has to do all the work — it's just allowed to be interrupted. If every child re-renders unconditionally each time, you've just moved the work, not reduced it. Memoising children means most subtrees can bail out of the low-priority pass entirely, and the framework only commits the parts that actually changed.

> **Q:** Why force a light palette in print, even for users in dark mode?
> **A:** Black backgrounds waste ink. White-on-black PDFs print poorly even on inkjet printers, and most resume readers (recruiters, ATS systems) expect a white page. The forced override is one CSS block and removes a class of "my resume looks weird when printed" support questions.

> **Q:** Why `queueMicrotask` before `window.print()`?
> **A:** React's commit phase has run, but the browser hasn't painted yet. Some browsers snapshot the pre-paint state if `print()` fires from inside the same microtask. Deferring with `queueMicrotask` (or `requestAnimationFrame`, or `setTimeout(0)`) ensures the print dialog sees the rendered DOM. `queueMicrotask` is the cheapest of those — `setTimeout(0)` adds a visible flash on slower machines.

## What's next: Phase 8 — Frontend testing setup

- Vitest + Vite shared config (one resolver, one set of plugins).
- React Testing Library + jest-dom matchers for component assertions.
- MSW at the network boundary so the real `fetch` wrapper is exercised.
- Smoke tests for the API client, the SSE stream parser, and the Preview tree.
