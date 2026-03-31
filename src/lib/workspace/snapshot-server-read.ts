import fs from "node:fs/promises"
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin"
import {
  emptyWorkspaceSnapshot,
  normalizeWorkspaceSnapshot,
  type WorkspaceSnapshotV1,
} from "@/lib/workspace/persist"

export const WORKSPACE_COLLECTION = "workspaceSnapshots"
export const WORKSPACE_DOC_ID = "default"

export function workspaceFilePathFromEnv(): string | null {
  const raw = process.env.IRONWOOD_WORKSPACE_FILE?.trim()
  if (!raw) return null
  if (raw.startsWith("/")) return raw
  if (/^[A-Za-z]:[\\/]/.test(raw)) return raw
  return null
}

export type WorkspaceSnapshotReadDebug = {
  source: "firestore" | "firestore_bootstrap_empty" | "file" | "none"
  firestoreConfigured: boolean
  firestoreDocExists: boolean | null
  firestoreReadError: string | null
  workspaceFileEnvSet: boolean
  fileReadError: string | null
  counts: {
    projects: number
    tasks: number
    contacts: number
    companies: number
    deals: number
    documents: number
    calendarEvents: number
  }
  persistedAt: number | undefined
  selectedProjectFilterId: string | undefined
  /** First few projects for quick inspection (debug route only). */
  projectsPreview?: { id: string; name: string }[]
}

function fillDebugFromSnapshot(d: WorkspaceSnapshotReadDebug, s: WorkspaceSnapshotV1) {
  d.counts = {
    projects: s.projects.length,
    tasks: s.tasks.length,
    contacts: s.contacts.length,
    companies: s.companies.length,
    deals: s.deals.length,
    documents: Array.isArray(s.documents) ? s.documents.length : 0,
    calendarEvents: Array.isArray(s.calendarEvents) ? s.calendarEvents.length : 0,
  }
  d.persistedAt = s.persistedAt
  d.selectedProjectFilterId = s.selectedProjectFilterId
}

export type WorkspaceSnapshotReadResult =
  | { ok: true; snapshot: WorkspaceSnapshotV1; debug: WorkspaceSnapshotReadDebug }
  | {
      ok: false
      status: number
      error: string
      debug: WorkspaceSnapshotReadDebug
    }

/**
 * Same resolution order as GET /api/workspace/snapshot: Firestore (if configured),
 * then workspace file. When Firestore is configured but the doc is missing, returns
 * {@link emptyWorkspaceSnapshot} (bootstrap).
 */
export async function readWorkspaceSnapshotFromBackend(): Promise<WorkspaceSnapshotReadResult> {
  const db = getFirebaseAdminFirestore()
  const filePath = workspaceFilePathFromEnv()

  const debug: WorkspaceSnapshotReadDebug = {
    source: "none",
    firestoreConfigured: Boolean(db),
    firestoreDocExists: null,
    firestoreReadError: null,
    workspaceFileEnvSet: Boolean(filePath),
    fileReadError: null,
    counts: {
      projects: 0,
      tasks: 0,
      contacts: 0,
      companies: 0,
      deals: 0,
      documents: 0,
      calendarEvents: 0,
    },
    persistedAt: undefined,
    selectedProjectFilterId: undefined,
  }

  if (db) {
    try {
      const doc = await db.collection(WORKSPACE_COLLECTION).doc(WORKSPACE_DOC_ID).get()
      debug.firestoreDocExists = doc.exists
      if (doc.exists) {
        const parsed = normalizeWorkspaceSnapshot(doc.data() as unknown)
        if (!parsed) {
          return {
            ok: false,
            status: 422,
            error: "Invalid Firestore workspace snapshot.",
            debug,
          }
        }
        debug.source = "firestore"
        fillDebugFromSnapshot(debug, parsed)
        return { ok: true, snapshot: parsed, debug }
      }
      const empty = emptyWorkspaceSnapshot()
      debug.source = "firestore_bootstrap_empty"
      fillDebugFromSnapshot(debug, empty)
      return { ok: true, snapshot: empty, debug }
    } catch (e) {
      debug.firestoreReadError = (e as Error).message ?? String(e)
    }
  }

  if (!filePath) {
    return {
      ok: false,
      status: 503,
      error:
        "Set IRONWOOD_WORKSPACE_FILE to an absolute path in .env.local (e.g. /Users/you/.ironwood-workspace.json).",
      debug,
    }
  }

  try {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = normalizeWorkspaceSnapshot(JSON.parse(raw) as unknown)
    if (!parsed) {
      return {
        ok: false,
        status: 422,
        error: "Invalid workspace snapshot file.",
        debug,
      }
    }
    debug.source = "file"
    fillDebugFromSnapshot(debug, parsed)
    return { ok: true, snapshot: parsed, debug }
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      return {
        ok: false,
        status: 404,
        error: "Workspace file not found.",
        debug,
      }
    }
    debug.fileReadError = err.message || "Could not read workspace file."
    return {
      ok: false,
      status: 500,
      error: err.message || "Could not read workspace file.",
      debug,
    }
  }
}
