# Workspace sync and Firestore

The dashboard workspace (projects, tasks, CRM entities, documents metadata, etc.) is stored as **one JSON document** per environment.

## Where data lives

| Store | Location |
|--------|-----------|
| **Firestore (primary when configured)** | Collection `workspaceSnapshots`, document id `default` |
| **Optional file fallback** | Absolute path from env `IRONWOOD_WORKSPACE_FILE` |
| **Browser cache** | `localStorage` key `ironwood_workspace_v1` (offline / faster paint; overwritten after a successful server load when sync is on) |

### Read precedence (server)

When the Admin SDK can reach Firestore, **`GET /api/workspace/snapshot`** reads **Firestore first**. If the `default` document is missing, the API returns a valid **empty** bootstrap snapshot (no Firestore write until a client `PUT`). If Firestore throws (e.g. provisioning), the handler may fall back to **`IRONWOOD_WORKSPACE_FILE`** when that path is set.

### Write behavior

- **`PUT /api/workspace/snapshot`** accepts either a legacy body (plain `WorkspaceSnapshotV1`) or **`{ expectedPersistedAt, snapshot }`** for **optimistic locking**.
- The app sends `expectedPersistedAt` matching the last server version it saw. If another client saved first, the server responds **`409 Conflict`**; the UI refetches and applies the latest snapshot.
- **Strict validation**: set `IRONWOOD_WORKSPACE_REJECT_ORPHAN_TASKS=true` to reject saves where a task’s `projectId` does not exist in `projects` (HTTP **422** with `orphanTaskProjectIds`). In development, orphaned IDs are logged as warnings unless that env is set.

## Environment variables

| Variable | Role |
|----------|------|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin (server) — enables Firestore read/write |
| `NEXT_PUBLIC_IRONWOOD_WORKSPACE_SYNC` | Set to `0` to disable cloud sync (localStorage only) |
| `IRONWOOD_WORKSPACE_FILE` | Absolute path to a JSON snapshot file (dev / fallback) |
| `IRONWOOD_WORKSPACE_ALLOW_PRODUCTION` | Allows sync API in production without Admin when set (see route) |
| `IRONWOOD_WORKSPACE_REJECT_ORPHAN_TASKS` | Reject inconsistent task→project references on `PUT` |

## Debugging

- **`GET /api/workspace/snapshot/debug`** — counts, Firestore vs file source, preview of projects.
- **`GET /api/workspace/snapshot`** — response headers `X-Ironwood-Snapshot-Source`, `X-Ironwood-Projects-Count`, etc.

## Backup and recovery

- Export or back up the Firestore document **`workspaceSnapshots/default`** (Console, `gcloud`, or scheduled exports).
- To restore, write the JSON payload back to that document (or use `PUT` with a matching `expectedPersistedAt` / handle `409`).

## UI: repair tool

**Settings → Workspace data → Repair missing projects from links** recreates minimal `Project` rows from `projectId` on tasks and documents, then normal persistence runs. Use this after bad snapshots that dropped `projects` but kept tasks.
