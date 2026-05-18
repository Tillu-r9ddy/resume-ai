import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * ESLint flat config.
 *
 * WHY flat config (eslint.config.js) and not .eslintrc.json?
 *   ESLint v9+ moved to "flat config" as the new standard. It's plain JS, you can
 *   import dependencies normally, and there's no implicit cascade magic. Old
 *   `.eslintrc.json` still works in v9 but is deprecated → using flat config now
 *   future-proofs the project.
 *
 * WHY each plugin?
 *   • @eslint/js                      → core JS rules (unused vars, no-debugger, etc.)
 *   • typescript-eslint               → TS-aware rules (no-floating-promise, no-unsafe-any)
 *   • eslint-plugin-react-hooks       → enforces Rules of Hooks (#1 source of subtle React bugs)
 *   • eslint-plugin-react-refresh     → ensures HMR works (components exported alongside utils break it)
 *   • eslint-config-prettier          → DISABLES ESLint rules that fight Prettier (must be LAST)
 *
 * Common interview question: "Why use both Prettier AND ESLint?"
 *   ESLint = correctness (catches bugs). Prettier = style (no debate, just formats).
 *   eslint-config-prettier turns off ESLint's stylistic rules so they don't duplicate.
 */
export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'coverage', '.vite']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // IMPORTANT: prettier MUST be last. It removes stylistic rules from earlier configs.
      // If you put it first, the later configs would re-enable them and you'd get conflicts.
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
      // We don't enable parserOptions.project here because it's slow (full type-aware lint).
      // For type-aware rules, we'd add: parserOptions: { project: './tsconfig.app.json' }
      // and switch to tseslint.configs.recommendedTypeChecked. Trade-off: slower lint runs.
    },
    rules: {
      // ─────────────────────────────────────────────────────────────────────
      // Project-specific overrides — defaults are mostly good
      // ─────────────────────────────────────────────────────────────────────

      // Unused vars: allow leading-underscore convention for intentionally unused args.
      // E.g.: function handler(_event, value) { return value }
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // `console.log` is fine in dev but should never ship. `console.warn/error` OK.
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // Prefer `const` over `let` when not reassigned — small thing, big readability win.
      'prefer-const': 'error',

      // Catch the classic `==` vs `===` bug (e.g. `null == undefined` is true, surprising).
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
]);
