<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services overview

**Ironwood Planner** is a Next.js 16 (App Router) CRM & project-management dashboard. No external databases or services are required for development — all data persists in the browser via localStorage/IndexedDB.

### Common commands

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` (webpack, port 3000) |
| Lint | `npm run lint` |
| Tests | `npm test` (Vitest) |
| Build | `npm run build` |

### Caveats

- The dev server uses `--webpack` explicitly; Turbopack is available via `npm run dev:turbo` but the webpack mode is the default and more stable for server bundles.
- The first page load after `npm run dev` compiles on-demand and takes ~20 s; subsequent loads are fast.
- ESLint reports pre-existing warnings/errors (2 errors, 15 warnings as of the current codebase). These are not introduced by setup.
- AI features (Gemini assistant, document analysis) require a `GOOGLE_API_KEY` env var. Firebase persistence requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Both are optional; the app works fully without them using localStorage.
- Node.js 22 is required (see `.nvmrc`). The VM has it installed via the NodeSource apt repository.
