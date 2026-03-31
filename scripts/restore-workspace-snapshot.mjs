#!/usr/bin/env node
/**
 * Restore Firestore workspace from a backup JSON (same shape as localStorage / GET snapshot).
 *
 * Usage:
 *   node scripts/restore-workspace-snapshot.mjs /path/to/backup.json https://your-service.run.app
 *
 * If the server already has more data than your file, the API may return 422 with
 * `"destructive": true` in the JSON body; then re-run with FORCE=1 to send header
 * X-Ironwood-Workspace-Force-Downgrade: 1.
 *
 * A 422 without `destructive` means the body failed validation (wrong shape, or server
 * expects a newer API). Fixing the backup or redeploying fixes that — FORCE=1 does not.
 */
import fs from "node:fs"

const [, , filePath, baseUrl = "http://localhost:3000"] = process.argv
const force = process.env.FORCE === "1"

if (!filePath) {
  console.error(
    "Usage: node scripts/restore-workspace-snapshot.mjs <backup.json> [baseUrl]\n" +
      "  FORCE=1 only when the server returns 422 with destructive: true (downgrade guard)."
  )
  process.exit(1)
}

/** Same required fields as {@link normalizeWorkspaceSnapshot} in src/lib/workspace/persist.ts */
function coerceSnapshotForPut(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  let d = raw
  if (
    "snapshot" in d &&
    d.snapshot &&
    typeof d.snapshot === "object" &&
    !Array.isArray(d.snapshot)
  ) {
    d = d.snapshot
  }
  const version = d.version === 1 || d.version === "1" ? 1 : null
  if (version !== 1) return null
  if (!Array.isArray(d.projects)) return null
  const taskDefaultDueOffsetDays = (() => {
    if (typeof d.taskDefaultDueOffsetDays === "number" && Number.isFinite(d.taskDefaultDueOffsetDays)) {
      const n = Math.floor(d.taskDefaultDueOffsetDays)
      if (n >= 0 && n <= 365) return n
    }
    if (d.taskDefaultDueOffsetDays === null) return null
    return null
  })()
  const persistedAt = Date.now()
  return {
    version: 1,
    projects: d.projects,
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    contacts: Array.isArray(d.contacts) ? d.contacts : [],
    companies: Array.isArray(d.companies) ? d.companies : [],
    deals: Array.isArray(d.deals) ? d.deals : [],
    selectedProjectFilterId:
      typeof d.selectedProjectFilterId === "string" ? d.selectedProjectFilterId : "all",
    savedChatTurns: Array.isArray(d.savedChatTurns) ? d.savedChatTurns : [],
    documents: Array.isArray(d.documents) ? d.documents : [],
    calendarEvents: Array.isArray(d.calendarEvents) ? d.calendarEvents : [],
    taskDefaultDueOffsetDays,
    persistedAt,
  }
}

const fileRaw = JSON.parse(fs.readFileSync(filePath, "utf8"))
const snapshot = coerceSnapshotForPut(fileRaw)
if (!snapshot) {
  console.error(
    "File does not look like a workspace snapshot.\n" +
      "Need version 1, a projects array, and (after coercion) arrays for tasks/contacts/companies/deals.\n" +
      "If you exported `{ \"snapshot\": { ... } }`, the inner object is used automatically."
  )
  process.exit(1)
}

const getRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/workspace/snapshot`)
if (!getRes.ok) {
  console.error("GET /api/workspace/snapshot failed:", getRes.status, await getRes.text())
  process.exit(1)
}
const current = await getRes.json()

function coerceExpectedPersistedAt(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v)
  return null
}

const expectedPersistedAt = coerceExpectedPersistedAt(current.persistedAt)

const body = {
  expectedPersistedAt,
  snapshot,
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
    try {
      const j = JSON.parse(text)
      if (j.destructive) {
        console.error("Server rejected a destructive overwrite. To allow it, run with FORCE=1")
      } else if (j.orphanTaskProjectIds?.length) {
        console.error("Orphan tasks:", j.orphanTaskProjectIds)
      } else if (j.invalidWorkspacePutBody) {
        console.error(
          "Server could not parse the PUT body (invalidWorkspacePutBody). " +
            "FORCE=1 does not fix this. Update scripts/restore-workspace-snapshot.mjs from the repo or redeploy the app."
        )
      } else {
        console.error(
          "Body did not pass server validation (wrong JSON shape or older server build). " +
            "FORCE=1 does not fix this. Check backup fields match GET /api/workspace/snapshot, or redeploy the app."
        )
      }
    } catch {
      console.error("Could not parse error JSON; see response body above.")
    }
  }
  process.exit(1)
}

console.log("OK:", text)
