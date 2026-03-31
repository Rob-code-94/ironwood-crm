import fs from "node:fs/promises"
import { NextResponse } from "next/server"
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin"
import { normalizeWorkspaceSnapshot, type WorkspaceSnapshotV1 } from "@/lib/workspace/persist"
import {
  readWorkspaceSnapshotFromBackend,
  type WorkspaceSnapshotReadDebug,
  WORKSPACE_COLLECTION,
  WORKSPACE_DOC_ID,
  workspaceFilePathFromEnv,
} from "@/lib/workspace/snapshot-server-read"
import {
  assertWorkspacePutCas,
  parseWorkspacePutPayload,
  persistedAtFromStoredRaw,
  WorkspaceVersionConflictError,
} from "@/lib/workspace/workspace-put-payload"
import {
  assertNotDestructiveWorkspaceOverwrite,
  WorkspaceDestructiveOverwriteError,
} from "@/lib/workspace/workspace-snapshot-guards"
import { orphanTaskProjectIds } from "@/lib/workspace/workspace-snapshot-invariants"

export const runtime = "nodejs"

function syncAllowed(): boolean {
  if (getFirebaseAdminFirestore()) return true
  return (
    process.env.NODE_ENV === "development" ||
    process.env.IRONWOOD_WORKSPACE_ALLOW_PRODUCTION === "true"
  )
}

function parentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/")
  const idx = normalized.lastIndexOf("/")
  if (idx <= 0) return "/"
  return normalized.slice(0, idx)
}

function attachSnapshotDebugHeaders(res: NextResponse, debug: WorkspaceSnapshotReadDebug) {
  res.headers.set("X-Ironwood-Snapshot-Source", debug.source)
  res.headers.set("X-Ironwood-Firestore-Configured", debug.firestoreConfigured ? "1" : "0")
  res.headers.set(
    "X-Ironwood-Firestore-Doc-Exists",
    debug.firestoreDocExists === null ? "na" : debug.firestoreDocExists ? "1" : "0"
  )
  res.headers.set("X-Ironwood-Projects-Count", String(debug.counts.projects))
  res.headers.set("X-Ironwood-Tasks-Count", String(debug.counts.tasks))
  res.headers.set("X-Ironwood-Persisted-At", debug.persistedAt != null ? String(debug.persistedAt) : "")
  if (debug.firestoreReadError) {
    res.headers.set("X-Ironwood-Firestore-Read-Error", debug.firestoreReadError.slice(0, 200))
  }
}

export async function GET() {
  if (!syncAllowed()) {
    return NextResponse.json(
      {
        error:
          "Workspace file sync is only available in development (or set IRONWOOD_WORKSPACE_ALLOW_PRODUCTION=true).",
      },
      { status: 503 }
    )
  }

  const result = await readWorkspaceSnapshotFromBackend()
  if (!result.ok) {
    const res = NextResponse.json({ error: result.error }, { status: result.status })
    attachSnapshotDebugHeaders(res, result.debug)
    return res
  }

  const res = NextResponse.json(result.snapshot)
  attachSnapshotDebugHeaders(res, result.debug)
  return res
}

function forceDowngrade(req: Request): boolean {
  return req.headers.get("x-ironwood-workspace-force-downgrade") === "1"
}

export async function PUT(req: Request) {
  if (!syncAllowed()) {
    return NextResponse.json(
      {
        error:
          "Workspace file sync is only available in development (or set IRONWOOD_WORKSPACE_ALLOW_PRODUCTION=true).",
      },
      { status: 503 }
    )
  }
  const filePath = workspaceFilePathFromEnv()
  const db = getFirebaseAdminFirestore()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsedWrap = parseWorkspacePutPayload(body)
  if (!parsedWrap) {
    return NextResponse.json({ error: "Body is not a valid workspace snapshot." }, { status: 422 })
  }

  const { snapshot: parsed, expectedPersistedAt } = parsedWrap

  const orphans = orphanTaskProjectIds(parsed)
  if (
    orphans.length > 0 &&
    process.env.IRONWOOD_WORKSPACE_REJECT_ORPHAN_TASKS === "true"
  ) {
    return NextResponse.json(
      {
        error:
          "Snapshot has tasks referencing projects that are not in this workspace. Remove those links or add the projects first.",
        orphanTaskProjectIds: orphans,
      },
      { status: 422 }
    )
  }
  if (orphans.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      "[Ironwood workspace] PUT snapshot has tasks with missing projects:",
      orphans
    )
  }

  const withTime: typeof parsed = {
    ...parsed,
    persistedAt: typeof parsed.persistedAt === "number" ? parsed.persistedAt : Date.now(),
  }

  const force = forceDowngrade(req)

  if (db) {
    try {
      await db.runTransaction(async (transaction) => {
        const ref = db.collection(WORKSPACE_COLLECTION).doc(WORKSPACE_DOC_ID)
        const doc = await transaction.get(ref)
        const existingSnapshot = doc.exists
          ? normalizeWorkspaceSnapshot(doc.data() as unknown)
          : null
        const serverVersion = doc.exists
          ? persistedAtFromStoredRaw(doc.data() as unknown)
          : null
        assertWorkspacePutCas(expectedPersistedAt, serverVersion)
        if (existingSnapshot) {
          assertNotDestructiveWorkspaceOverwrite(existingSnapshot, withTime, force)
        }
        transaction.set(ref, withTime)
      })
      return NextResponse.json({ ok: true })
    } catch (e) {
      if (e instanceof WorkspaceVersionConflictError) {
        return NextResponse.json(
          {
            error: e.message,
            conflict: true,
            serverPersistedAt: e.serverPersistedAt,
          },
          { status: 409 }
        )
      }
      if (e instanceof WorkspaceDestructiveOverwriteError) {
        return NextResponse.json(
          { error: e.message, destructive: true },
          { status: 422 }
        )
      }
      // Fall through to file-based snapshot write
    }
  }

  if (!filePath) {
    return NextResponse.json(
      {
        error:
          "Set IRONWOOD_WORKSPACE_FILE to an absolute path in .env.local (e.g. /Users/you/.ironwood-workspace.json).",
      },
      { status: 503 }
    )
  }

  let existingFileSnapshot: WorkspaceSnapshotV1 | null = null
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const body = JSON.parse(raw) as unknown
    const parsedFile = normalizeWorkspaceSnapshot(body)
    if (parsedFile) existingFileSnapshot = parsedFile
    const fileVersion = persistedAtFromStoredRaw(body)
    assertWorkspacePutCas(expectedPersistedAt, fileVersion)
    if (existingFileSnapshot) {
      assertNotDestructiveWorkspaceOverwrite(existingFileSnapshot, withTime, force)
    }
  } catch (e) {
    if (e instanceof WorkspaceVersionConflictError) {
      return NextResponse.json(
        {
          error: e.message,
          conflict: true,
          serverPersistedAt: e.serverPersistedAt,
        },
        { status: 409 }
      )
    }
    if (e instanceof WorkspaceDestructiveOverwriteError) {
      return NextResponse.json(
        { error: e.message, destructive: true },
        { status: 422 }
      )
    }
    const err = e as NodeJS.ErrnoException
    if (err.code !== "ENOENT") throw e
    assertWorkspacePutCas(expectedPersistedAt, null)
  }

  const dir = parentDirectory(filePath)
  const tmp = `${dir}/.ironwood-workspace-${process.pid}-${Date.now()}.tmp`

  try {
    await fs.mkdir(dir, { recursive: true })
    const payload = `${JSON.stringify(withTime)}\n`
    await fs.writeFile(tmp, payload, "utf8")
    await fs.rename(tmp, filePath)
  } catch (e) {
    try {
      await fs.unlink(tmp)
    } catch {
      /* ignore */
    }
    const err = e as Error
    return NextResponse.json(
      { error: err.message || "Could not write workspace file." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
