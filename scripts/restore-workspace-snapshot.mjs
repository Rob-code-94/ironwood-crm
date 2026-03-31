#!/usr/bin/env node
/**
 * Restore Firestore workspace from a backup JSON (same shape as localStorage / GET snapshot).
 *
 * Usage:
 *   node scripts/restore-workspace-snapshot.mjs /path/to/backup.json https://your-service.run.app
 *
 * If the server already has more data than your file, the API may return 422;
 * then re-run with FORCE=1 to send header X-Ironwood-Workspace-Force-Downgrade: 1.
 */
import fs from "node:fs"

const [, , filePath, baseUrl = "http://localhost:3000"] = process.argv
const force = process.env.FORCE === "1"

if (!filePath) {
  console.error(
    "Usage: node scripts/restore-workspace-snapshot.mjs <backup.json> [baseUrl]\n" +
      "  FORCE=1 to allow replacing a fuller server snapshot with a smaller file."
  )
  process.exit(1)
}

const snapshot = JSON.parse(fs.readFileSync(filePath, "utf8"))
if (snapshot.version !== 1 || !Array.isArray(snapshot.projects)) {
  console.error("File does not look like a workspace snapshot (expected version 1 + projects array).")
  process.exit(1)
}

const getRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/workspace/snapshot`)
if (!getRes.ok) {
  console.error("GET /api/workspace/snapshot failed:", getRes.status, await getRes.text())
  process.exit(1)
}
const current = await getRes.json()
const expectedPersistedAt =
  typeof current.persistedAt === "number" && Number.isFinite(current.persistedAt)
    ? current.persistedAt
    : null

const body = {
  expectedPersistedAt,
  snapshot: {
    ...snapshot,
    persistedAt: Date.now(),
  },
}

const headers = { "Content-Type": "application/json" }
if (force) headers["X-Ironwood-Workspace-Force-Downgrade"] = "1"

const putRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/workspace/snapshot`, {
  method: "PUT",
  headers,
  body: JSON.stringify(body),
})

const text = await putRes.text()
if (!putRes.ok) {
  console.error("PUT failed:", putRes.status, text)
  if (putRes.status === 409) {
    console.error("Version conflict: re-fetch snapshot and run again, or adjust expectedPersistedAt.")
  }
  if (putRes.status === 422) {
    console.error("If you meant to replace server data with this file, run with FORCE=1")
  }
  process.exit(1)
}

console.log("OK:", text)
