/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'node:path';

// ANALYZE=1 npm run build -w frontend → emits dist/stats.html with a treemap
// of the bundle. Off by default so normal builds stay fast and don't open
// browser tabs in CI. Phase 5 baseline / after numbers live in
// docs/05-phase-performance.md.
const ANALYZE = process.env.ANALYZE === '1';

// VITE_PROFILE=1 npm run build -w frontend → swap react-dom for its profiling
// build so React's <Profiler> onRender callback fires in production builds.
// Off by default — adds ~3 kB gz and a small runtime cost. Use it for the
// dev-vs-prod comparison loop documented in docs/05-phase-performance.md,
// then unset for normal builds. The matching client-side gate lives in
// src/components/dev/RenderProfiler.tsx.
const PROFILE = process.env.VITE_PROFILE === '1';

/**
 * Vite configuration.
 *
 * ┌─ WHY Vite? ─────────────────────────────────────────────────────────────┐
 * │ • In dev: Vite serves your source files over native ES modules. The     │
 * │   browser pulls each module on-demand → server starts in <300ms even    │
 * │   for huge apps. Webpack bundles EVERYTHING before serving → starts can │
 * │   take 30s+ on large codebases.                                         │
 * │ • In prod: Vite uses Rollup (also tree-shakes well) for the output.     │
 * │ • Vite ships sensible defaults (TS, JSX, CSS modules, asset handling)   │
 * │   without a 400-line config file like Webpack typically needs.          │
 * │                                                                         │
 * │ Common interview question: "Why is Vite faster than Webpack in dev?"   │
 * │ Answer: native ESM in browser + esbuild for deps + on-demand transform.│
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Docs: https://vite.dev/config/
 */
export default defineConfig({
  plugins: [
    /**
     * The official React plugin. Provides:
     *   • Fast Refresh (preserves component state on edit — way better than full reload)
     *   • JSX transform via SWC (faster than Babel)
     *   • Automatic JSX runtime (no need to `import React from 'react'` everywhere)
     */
    react(),

    /**
     * Tailwind v4's first-party Vite plugin.
     *
     * WHY this and not the classic `postcss + tailwind.config.js` setup?
     *   Tailwind 4 ships its own high-performance engine (built on Lightning CSS).
     *   The Vite plugin scans your source files itself, generates the utility CSS,
     *   and HMR-updates styles without a PostCSS round-trip. Result: dev rebuilds
     *   are ~5× faster, and there's NO `tailwind.config.js` to maintain — config
     *   moves into your CSS via the `@theme` directive (see src/index.css).
     *
     * Interview hook: "How does Tailwind 4 differ from Tailwind 3?"
     *   • Zero-JS-config (CSS-first config with @theme)
     *   • Lightning CSS engine → faster, smaller output
     *   • Native CSS cascade layers
     *   • Auto content detection (no `content: [...]` array)
     */
    tailwindcss(),

    /**
     * Bundle visualizer — only added when ANALYZE=1. Emits dist/stats.html
     * with treemap + gzip + brotli sizes per module. Opens automatically.
     */
    ...(ANALYZE
      ? [
          visualizer({
            filename: 'dist/stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
            open: true,
          }),
        ]
      : []),
  ],

  resolve: {
    alias: [
      /**
       * Path alias: `@/foo` → `<frontend>/src/foo`
       *
       * WHY use aliases?
       *   ❌ Without:  import Button from '../../../../components/ui/Button';
       *   ✅ With:     import Button from '@/components/ui/Button';
       *
       * The TS-side mirror lives in tsconfig.app.json's `paths`. Both MUST agree —
       * Vite resolves at runtime, TS resolves at type-check time. If they drift,
       * your editor shows red squiggles but `npm run dev` still works (or vice versa).
       */
      { find: '@', replacement: path.resolve(__dirname, './src') },

      /**
       * When VITE_PROFILE=1, swap react-dom for react-dom/profiling. The default
       * production React strips Profiler instrumentation, so onRender silently
       * never fires. The profiling build keeps the instrumentation — slightly
       * larger and slightly slower, but actually measurable. Exact-match regex
       * so we don't accidentally redirect `react-dom/client` or `react-dom/server`.
       */
      ...(PROFILE ? [{ find: /^react-dom$/, replacement: 'react-dom/profiling' }] : []),
    ],
  },

  server: {
    /**
     * Default Vite port. We pin it so README/Docker/CI all agree.
     * If 5173 is busy, Vite normally falls through to 5174... → use `strictPort` to
     * fail loudly instead, which is what you want in CI.
     */
    port: 5173,
    strictPort: false,
    /**
     * `open: true` opens the browser automatically on `npm run dev`.
     * Disabled here because it's annoying when running in tmux/Docker/CI.
     */
    open: false,
  },

  /**
   * Vitest configuration — Phase 8.
   *
   * WHY this lives in vite.config.ts (not vitest.config.ts):
   *   Vitest reuses Vite's resolver, plugins (@vitejs/plugin-react for JSX,
   *   @tailwindcss/vite for class processing) and aliases. Sharing the config
   *   means tests resolve modules exactly like production — no surprise diff
   *   between "passes in test, breaks in build".
   *
   * `environment: 'jsdom'` gives us window/document so RTL can render.
   * `setupFiles` extends `expect` with @testing-library/jest-dom matchers and
   * starts the MSW server so fetch() is intercepted in every test.
   * `globals: true` means `describe`, `it`, `expect` are available without
   * imports — matches Jest ergonomics and keeps test files terse.
   */
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },

  build: {
    /**
     * `outDir`: where prod bundles land. Default is `dist/`. Be explicit.
     * `sourcemap: true`: ship sourcemaps so prod stack traces map back to your TS.
     *   In serious enterprise apps you'd upload sourcemaps to Sentry and NOT serve
     *   them publicly (security: leaks your source). We'll handle that in Phase 9.
     * `target: 'es2022'`: modern browsers only. Drop legacy = smaller bundles.
     * `chunkSizeWarningLimit`: bump from default 500KB once you understand WHY
     *   chunks are big. For now, keep default so warnings push you to optimize.
     */
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    /**
     * Rollup output options — Phase 5 vendor split.
     *
     * Default Vite chunking puts every node_modules dep into one giant
     * `vendor` chunk that all routes pay for upfront. Splitting it lets the
     * Home and Chat routes skip the editor-only families (react-hook-form,
     * zod, @dnd-kit) until the user navigates to /editor — those families
     * still ship as separate cache-friendly chunks instead of being bundled
     * into the Editor chunk.
     *
     * Buckets are intentionally coarse: each group is one logical "library
     * family" that ships and upgrades together. Finer-grained splitting
     * (one chunk per package) increases waterfall depth without buying
     * meaningful cache wins because the packages always change together.
     */
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-hook-form') || id.includes('@hookform')) return 'forms';
          if (id.includes('/zod/') || id.endsWith('/zod')) return 'forms';
          if (id.includes('@dnd-kit')) return 'dnd';
          if (id.includes('@reduxjs/toolkit') || id.includes('react-redux')) return 'state';
          if (
            id.includes('/redux-undo') ||
            id.includes('/redux-persist') ||
            id.includes('/redux/')
          ) {
            return 'state';
          }
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router')) {
            return 'react';
          }
          // Everything else stays in the default vendor bucket.
          return undefined;
        },
      },
    },
  },
});
