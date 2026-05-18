import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

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
  ],

  resolve: {
    alias: {
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
      '@': path.resolve(__dirname, './src'),
    },
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
     * Rollup output options — we'll customize splitting in Phase 5.
     * For now, Vite's auto-splitting (route-level + vendor) is fine.
     */
    rollupOptions: {
      output: {
        // Phase 5 will add manualChunks() for vendor split & per-feature chunks.
      },
    },
  },
});
