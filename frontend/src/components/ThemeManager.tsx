/**
 * ThemeManager — applies the active theme to the document root.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a dedicated component instead of an inline effect somewhere?
 * ─────────────────────────────────────────────────────────────────────────────
 *   The store is the source of truth for theme; the DOM is a side-effect of
 *   that truth. Putting the bridge in its own component keeps responsibilities
 *   clean — and makes the DOM mutation easy to unmount/remount in tests.
 *
 *   It renders `null` because the only thing it owns is a CSS side-effect on
 *   <html>. Components that exist purely for effects are a legitimate pattern;
 *   just keep them rare and well-named.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * How the actual theming works (no Tailwind `dark:` variants required)
 * ─────────────────────────────────────────────────────────────────────────────
 *   In src/index.css we define one set of `--color-*` tokens under `@theme`
 *   (the dark defaults) and an override block under `[data-theme="light"]`.
 *   Tailwind v4's utility classes reference those tokens via `var(...)` — so
 *   flipping the attribute on <html> swaps every `bg-canvas`/`text-ink`/etc
 *   across the entire tree with zero re-render.
 *
 *   This trick wins over class-toggling `dark:` variants when:
 *     • You have MORE THAN TWO themes (high-contrast, sepia, brand variants)
 *     • You want one set of utility names — components don't repeat `dark:`
 *     • You want non-Tailwind CSS (e.g. third-party libs) to react to theme
 */
import { useEffect } from 'react';
import { useTheme } from '../stores/useUiStore';

export function ThemeManager(): null {
  const theme = useTheme();

  useEffect(() => {
    // Set on <html>, not <body>. Why? Some libraries (toasters, modals) render
    // into portals attached to <body> — keeping the attribute one level up
    // ensures the cascade still reaches them.
    document.documentElement.dataset.theme = theme;

    // `color-scheme` tells the *browser* (form controls, scrollbars) what to
    // expect. Without this, light theme would still show dark scrollbars on
    // Chromium → noticeable visual mismatch.
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return null;
}
