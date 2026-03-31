import { NextResponse } from "next/server"
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin"
import { readWorkspaceSnapshotFromBackend } from "@/lib/workspace/snapshot-server-read"

export const runtime = "nodejs"

function syncAllowed(): boolean {
  if (getFirebaseAdminFirestore()) return true
  return (
    process.env.NODE_ENV === "development" ||
    process.env.IRONWOOD_WORKSPACE_ALLOW_PRODUCTION === "true"
  )
}

/**
 * Inspect workspace sync resolution (Firestore vs file), counts, and preview rows.
 * GET only. Open in browser while the app is running: `/api/workspace/snapshot/debug`
 *
 * Note: `localStorage` summary is only included in the browser if you open this URL
 * in the same origin as the app (still shows server-side read).
 */
export async function GET() {
  if (!syncAllowed()) {
    return NextResponse.json(
      {
        error:
          "Workspace sync debug is only available in development (or with Firestore / IRONWOOD_WORKSPACE_ALLOW_PRODUCTION).",
        hint: "Configure FIREBASE_* admin env vars or run in development.",
      },
      { status: 503 }
    )
  }

  const result = await readWorkspaceSnapshotFromBackend()

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false as const,
        status: result.status,
        error: result.error,
        debug: result.debug,
        firestorePath: "workspaceSnapshots/default",
      },
      { status: 200 }
    )
  }

  const { snapshot, debug } = result
  debug.projectsPreview = snapshot.projects.slice(0, 20).map((p) => ({
    id: p.id,
    name: p.name,
  }))

  return NextResponse.json({
    ok: true as const,
    firestorePath: "workspaceSnapshots/default",
    env: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_IRONWOOD_WORKSPACE_SYNC: process.env.NEXT_PUBLIC_IRONWOOD_WORKSPACE_SYNC ?? "(unset, sync enabled by default)",
      IRONWOOD_WORKSPACE_FILE: process.env.IRONWOOD_WORKSPACE_FILE ? "(set)" : "(unset)",
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "(set)" : "(unset)",
    },
    debug,
    note:
      "If source is firestore_bootstrap_empty, Firestore has no doc yet — the client may upload on next save. " +
      "If counts are 0 but you expect data, check you are on the same Firebase project as production.",
  })
}
