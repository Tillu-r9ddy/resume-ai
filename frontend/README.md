# `frontend/` — Resume-AI React app

Vite + React 19 + TypeScript 6. The runtime entry point is [`src/main.tsx`](./src/main.tsx).

> **Tip:** Every config file in this folder is heavily commented with a "WHY" rationale. Read them in this order:
>
> 1. `vite.config.ts` — bundler config (what builds the app)
> 2. `tsconfig.app.json` — type-checking + path aliases
> 3. `eslint.config.js` — code-quality rules + Prettier integration
> 4. `webpack.config.js` — **learning-only** parallel Webpack config (NOT used to build)

## File map

```
frontend/
├── index.html              ← Single HTML page Vite serves; <script> entrypoint
├── package.json            ← Workspace package — scripts + deps
├── vite.config.ts          ← Vite bundler config (active)
├── webpack.config.js       ← Webpack config for learning (inactive)
├── tsconfig.json           ← TS solution file — refs app + node configs
├── tsconfig.app.json       ← TS rules for the app code (src/)
├── tsconfig.node.json      ← TS rules for Vite config itself
├── eslint.config.js        ← ESLint flat config
└── src/
    ├── main.tsx            ← Mounts <App /> into #root
    ├── App.tsx             ← Root component (Phase 1 placeholder)
    ├── App.css             ← Phase 1 stub styles (replaced in Phase 2 by Tailwind)
    └── index.css           ← Global reset + dark canvas
```

## The "why" of why everything is split

- **vite.config.ts vs tsconfig.app.json:** Vite and TypeScript are **two separate resolvers**. Path aliases (`@/foo`) must be declared in BOTH. They don't share config. This is one of the most common interview gotchas.
- **tsconfig.app.json vs tsconfig.node.json:** Different runtime contexts have different globals. `vite.config.ts` runs in Node and needs `import.meta`, `process.env`. Your app code runs in browsers and needs `DOM`, `window`. Splitting prevents accidental cross-pollination (e.g. importing `fs` in a React component should error).
- **eslint.config.js vs .prettierrc.json:** ESLint = correctness rules. Prettier = style. `eslint-config-prettier` disables every ESLint rule that touches whitespace/formatting so the two tools never fight. The order in `extends` MATTERS — prettier must be last.

## When to update what

| Task                                                       | Update                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Add a path alias like `@components/*`                      | `vite.config.ts` AND `tsconfig.app.json` (both!)                   |
| Add a build-time env var (e.g. API URL)                    | `.env`, `vite.config.ts` `define`, and add to `vite-env.d.ts`      |
| Add a new ESLint rule                                      | `eslint.config.js`                                                 |
| Add a Prettier override (e.g. `printWidth` for one folder) | `.prettierrc.json` (use `overrides:` array)                        |
| Add a new dependency                                       | `npm install --workspace=@resume-ai/frontend <pkg>` from repo root |

## Verifying the toolchain (Phase 1 acceptance criteria)

After `npm install`, all of these should succeed:

```bash
npm run dev         # opens http://localhost:5173 with the Phase 1 welcome screen
npm run typecheck   # zero errors
npm run lint        # zero errors, zero warnings
npm run format:check # zero formatting violations
npm run build       # produces dist/ with content-hashed assets
```

If any of these fail, fix before moving to Phase 2.
