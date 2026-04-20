#!/usr/bin/env node
// Assembles the Next.js standalone server output into a self-contained folder
// that electron-builder ships under `process.resourcesPath/server/` inside the
// packaged app.
//
// Layout produced (must NOT put `node_modules` at the root of `electron/build/server/`):
// electron-builder excludes a top-level `node_modules` folder in extraResources
// (see app-builder-lib createFilter: relative === "node_modules" → false).
// Nesting under `app/` keeps `app/node_modules/next` in the bundle.
//
//   electron/build/server/app/server.js
//   electron/build/server/app/.next/static/...
//   electron/build/server/app/public/...
//   electron/build/server/app/node_modules/... (from standalone)

import { cp, mkdir, rm, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const standalone = path.join(root, ".next", "standalone")
const staticDir = path.join(root, ".next", "static")
const publicDir = path.join(root, "public")
const out = path.join(root, "electron", "build", "server")

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(standalone))) {
    console.error(
      `Standalone output missing at ${standalone}. Run \`next build\` first (next.config.ts must keep \`output: "standalone"\`).`
    )
    process.exit(1)
  }

  if (existsSync(out)) {
    await rm(out, { recursive: true, force: true })
  }
  await mkdir(out, { recursive: true })

  const appRoot = path.join(out, "app")
  await mkdir(appRoot, { recursive: true })

  const copyOpts = { recursive: true, dereference: true }

  // 1. The standalone tree already contains server.js + a slim node_modules.
  // Dereference symlinks so `node_modules` does not point outside the bundle;
  // otherwise `codesign --verify --strict` fails with "invalid destination for
  // symbolic link in bundle" when electron-builder packages the app.
  await cp(standalone, appRoot, copyOpts)

  // 2. Static assets aren't included by `output: standalone`; copy them into the
  //    same `.next/` location the server expects.
  if (await exists(staticDir)) {
    await cp(staticDir, path.join(appRoot, ".next", "static"), copyOpts)
  }

  // 3. `public/` is loaded relative to cwd at runtime.
  if (await exists(publicDir)) {
    await cp(publicDir, path.join(appRoot, "public"), copyOpts)
  }

  // Defensive: if `dist/` was ever traced into standalone (e.g. old Electron
  // output still on disk during `next build`), drop it — nested `.app` bundles
  // break macOS codesign inside the real Electron shell.
  const nestedDist = path.join(appRoot, "dist")
  if (existsSync(nestedDist)) {
    await rm(nestedDist, { recursive: true, force: true })
  }

  console.log(`Bundled server prepared at ${path.relative(root, appRoot)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
