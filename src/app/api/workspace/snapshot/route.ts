import fs from "node:fs/promises"
import { NextResponse } from "next/server"
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin"
import { emptyWorkspaceSnapshot, normalizeWorkspaceSnapshot } from "@/lib/workspace/persist"

export const runtime = "nodejs"

const WORKSPACE_COLLECTION = "workspaceSnapshots"
const WORKSPACE_DOC_ID = "default"

function syncAllowed(): boolean {
  // Allow sync in production when Firestore is configured.
  if (getFirebaseAdminFirestore()) return true
  return (
    process.env.NODE_ENV === "development" ||
    process.env.IRONWOOD_WORKSPACE_ALLOW_PRODUCTION === "true"
  )
}

/** Require an absolute path so we never need path.resolve (keeps Turbopack NFT tracing calm). */
function workspaceFilePath(): string | null {
  const raw = process.env.IRONWOOD_WORKSPACE_FILE?.trim()
  if (!raw) return null
  if (raw.startsWith("/")) return raw
  if (/^[A-Za-z]:[\\/]/.test(raw)) return raw
  return null
}

function parentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/")
  const idx = normalized.lastIndexOf("/")
  if (idx <= 0) return "/"
  return normalized.slice(0, idx)
}

export async function GET() {
  if (!syncAllowed()) {
    return NextResponse.json(
      { error: "Workspace file sync is only available in development (or set IRONWOOD_WORKSPACE_ALLOW_PRODUCTION=true)." },
      { status: 503 }
    )
  }
  const filePath = workspaceFilePath()
  const db = getFirebaseAdminFirestore()

  if (db) {
    try {
      const doc = await db.collection(WORKSPACE_COLLECTION).doc(WORKSPACE_DOC_ID).get()
      if (doc.exists) {
        const parsed = normalizeWorkspaceSnapshot(doc.data() as unknown)
        if (!parsed) {
          return NextResponse.json({ error: "Invalid Firestore workspace snapshot." }, { status: 422 })
        }
        return NextResponse.json(parsed)
      }
      // Firestore is live but no workspace doc yet — return empty snapshot so clients can sync (PUT will create it).
      return NextResponse.json(emptyWorkspaceSnapshot())
    } catch {
      // Fall through to file-based sync so local dev remains usable while Firestore is provisioning.
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

  try {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = normalizeWorkspaceSnapshot(JSON.parse(raw) as unknown)
    if (!parsed) {
      return NextResponse.json({ error: "Invalid workspace snapshot file." }, { status: 422 })
    }
    return NextResponse.json(parsed)
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.json(
      { error: err.message || "Could not read workspace file." },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  if (!syncAllowed()) {
    return NextResponse.json(
      { error: "Workspace file sync is only available in development (or set IRONWOOD_WORKSPACE_ALLOW_PRODUCTION=true)." },
      { status: 503 }
    )
  }
  const filePath = workspaceFilePath()
  const db = getFirebaseAdminFirestore()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = normalizeWorkspaceSnapshot(body)
  if (!parsed) {
    return NextResponse.json({ error: "Body is not a valid workspace snapshot." }, { status: 422 })
  }

  const withTime: typeof parsed = {
    ...parsed,
    persistedAt: typeof parsed.persistedAt === "number" ? parsed.persistedAt : Date.now(),
  }

  if (db) {
    try {
      await db.collection(WORKSPACE_COLLECTION).doc(WORKSPACE_DOC_ID).set(withTime)
      return NextResponse.json({ ok: true })
    } catch {
      // Fall through to file-based snapshot write in environments where Firestore is not ready.
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
