import {
  idbGetAssistantRemoteOps,
  idbSetAssistantRemoteOps,
  type AssistantRemoteOutboxRow,
} from "@/lib/workspace/storage/ironwood-idb"

/**
 * Sends queued assistant PATCH/POST operations (e.g. after failed requests while offline).
 */
export async function flushCrmAssistantRemoteQueue(): Promise<void> {
  const ops = await idbGetAssistantRemoteOps()
  if (ops.length === 0) return

  const remaining: AssistantRemoteOutboxRow[] = []

  for (const op of ops) {
    try {
      if (op.kind === "patch") {
        const res = await fetch(`/api/assistant/threads/${op.remoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op.body),
        })
        if (!res.ok) remaining.push(op)
      } else if (op.kind === "post") {
        const res = await fetch(op.path.startsWith("/") ? op.path : `/${op.path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...(op.body ? { body: JSON.stringify(op.body) } : {}),
        })
        if (!res.ok) remaining.push(op)
      }
    } catch {
      remaining.push(op)
    }
  }

  await idbSetAssistantRemoteOps(remaining)
}

export async function enqueueAssistantPatch(
  remoteId: string,
  body: Record<string, unknown>
): Promise<void> {
  const { idbEnqueueAssistantRemoteOp } = await import("@/lib/workspace/storage/ironwood-idb")
  await idbEnqueueAssistantRemoteOp({
    kind: "patch",
    remoteId,
    body,
    id: crypto.randomUUID(),
  })
}
