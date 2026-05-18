# Phase 1 — Foundation

> Goal: a working Vite + React + TS app with enterprise-grade tooling, ready to grow into a real product. No features yet. Just bones.

## What we set up and WHY each piece exists

### 1. Monorepo with npm workspaces

- `frontend/` is a workspace, `backend/` will be later. Root `package.json` has `workspaces: ["frontend"]`.
- **Why:** one `npm install` from root installs everything; shared dev tooling (Prettier, Husky, commitlint) lives ONCE at root. No duplication. Real enterprise codebases follow this pattern (often with Nx/Turborepo on top — we'll see those in Phase 9).

### 2. Vite over Webpack (for builds)

- **Dev speed:** Vite serves source over native ES modules. Browser pulls modules on demand → cold start under 300ms even on huge projects. Webpack bundles everything first → can take 30s+ on large repos.
- **Prod:** Vite uses Rollup under the hood. Same tree-shaking quality as Webpack with less config.
- **You still need to know Webpack** because most large legacy codebases use it. That's why `webpack.config.js` exists in this repo as a heavily-commented learning artifact.

### 3. TypeScript with full strict mode

- Every `strict*` flag is on (`tsconfig.app.json` lines 38–48).
- **Why:** every flag corresponds to a real prod bug pattern. `strictNullChecks` alone catches the entire "null pointer" class of crashes.
- We also enabled `noUncheckedIndexedAccess` — this forces you to handle the `undefined` case when you do `arr[0]`. It's pedantic but it catches off-by-one bugs.

### 4. ESLint flat config + typescript-eslint + react-hooks + react-refresh + prettier

- **flat config** (`eslint.config.js`) is the new ESLint v9 standard; the old `.eslintrc.json` is deprecated.
- `react-hooks` enforces the [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks). #1 source of subtle React bugs is calling hooks conditionally.
- `react-refresh` warns when files export non-component values alongside components (breaks HMR).
- `eslint-config-prettier` MUST be the LAST extend — it disables stylistic ESLint rules that would otherwise fight Prettier.

### 5. Prettier + EditorConfig

- **EditorConfig** sets baseline whitespace rules at the editor level (before save).
- **Prettier** does opinionated formatting on save / on commit.
- They overlap deliberately — EditorConfig works in editors that don't load Prettier; Prettier provides richer formatting.

### 6. Husky + lint-staged + commitlint

- **Husky** installs git hooks (`.husky/pre-commit`, `.husky/commit-msg`).
- **lint-staged** runs linters/formatters ONLY on staged files (fast, doesn't re-lint the whole repo on every commit).
- **commitlint** rejects commits not matching Conventional Commits format.
- **Why so much ceremony?** Once these exist, code review is freed up to discuss DESIGN instead of "missing semicolon" comments. Senior engineers spend their review time on architecture, not style.

### 7. Path aliases (`@/*` → `src/*`)

- Declared in BOTH `vite.config.ts` (runtime resolver) AND `tsconfig.app.json` (TS resolver). Both are required. Drift between them is a common interview question.

### 8. `.gitignore` with explained sections

- Every gitignore section has a WHY comment. The single biggest mistake junior devs make is committing `.env` files with API keys.

## Phase 1 acceptance criteria

✅ `npm install` succeeds at repo root.
✅ `npm run dev` serves the Phase 1 welcome screen at http://localhost:5173.
✅ `npm run lint` passes with zero warnings.
✅ `npm run typecheck` passes.
✅ `npm run build` produces `frontend/dist/`.
✅ `git commit -m "broken format"` is REJECTED by commitlint.
✅ `git commit -m "feat(scaffold): initialize resume-ai monorepo"` is accepted.

## Interview questions Phase 1 prepares you to answer

> **Q:** Why is Vite faster than Webpack in development?
> **A:** Vite serves source files over native ES modules — the browser fetches modules on demand instead of waiting for a bundle. Vite also pre-bundles `node_modules` deps with esbuild (10–100× faster than Webpack's JS-based bundling) and only transforms files when the browser actually requests them. Webpack must bundle the entire dep graph before serving the first byte.

> **Q:** What's the difference between `.eslintrc` and flat config?
> **A:** Flat config (`eslint.config.js`) is plain JS — explicit, no implicit cascade up the directory tree, no `extends` magic strings (you `import` configs as values). The old format relied on implicit resolution which made debugging "where did this rule come from?" painful. ESLint v9 deprecates the old format.

> **Q:** Why both ESLint AND Prettier?
> **A:** Different jobs. ESLint catches correctness bugs (unused vars, missing deps in hooks, no-floating-promises). Prettier handles purely cosmetic formatting (line width, trailing commas, quote style). You disable ESLint's stylistic rules via `eslint-config-prettier` so the two tools don't fight.

> **Q:** How do you set up path aliases in Vite + TS?
> **A:** Two files. `vite.config.ts` → `resolve.alias` for the runtime (so the bundler can find modules). `tsconfig.app.json` → `paths` for the type system (so the editor/tsc can find types). They MUST agree; drift causes either red squiggles with green builds or vice versa.

> **Q:** Why use `createRoot` instead of `ReactDOM.render`?
> **A:** `createRoot` (React 18+) opts into concurrent rendering — automatic batching, `useTransition`, Suspense for data fetching, interruptible rendering. The old `ReactDOM.render` is blocking and legacy.

> **Q:** What does `<StrictMode>` actually do?
> **A:** In development, it double-invokes render functions, effects, and reducers to surface side effects you accidentally put where they shouldn't be. It also warns about deprecated APIs. Production builds strip it — zero runtime cost.

## What's next: Phase 2

- Add React Router v7 with **lazy loading** (each route in its own chunk).
- Set up `<Suspense>` boundaries with skeleton loaders.
- Add error boundaries (both class-based and `react-error-boundary` library).
- Add Tailwind for styling so we can build real UI faster.
- Add a basic layout (`<Shell>` with sidebar + main area).
