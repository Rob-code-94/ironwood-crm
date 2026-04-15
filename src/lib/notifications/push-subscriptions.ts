import { getFirebaseAdminFirestore } from "@/lib/firebase-admin"

const PUSH_SUBSCRIPTIONS_COLLECTION = "pushSubscriptions"

export type StoredPushSubscription = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  expirationTime?: number | null
}

const memorySubscriptions = new Map<string, StoredPushSubscription>()

function normalizeSubscription(input: unknown): StoredPushSubscription | null {
  if (!input || typeof input !== "object") return null
  const row = input as {
    endpoint?: unknown
    expirationTime?: unknown
    keys?: { p256dh?: unknown; auth?: unknown } | unknown
  }
  if (typeof row.endpoint !== "string" || !row.endpoint.trim()) return null
  const endpoint = row.endpoint.trim()
  const p256dh =
    row.keys && typeof row.keys === "object" && typeof (row.keys as { p256dh?: unknown }).p256dh === "string"
      ? (row.keys as { p256dh: string }).p256dh
      : null
  const auth =
    row.keys && typeof row.keys === "object" && typeof (row.keys as { auth?: unknown }).auth === "string"
      ? (row.keys as { auth: string }).auth
      : null
  if (!p256dh || !auth) return null
  const keys = { p256dh, auth }
  const expirationTime =
    typeof row.expirationTime === "number" ? row.expirationTime : null
  return { endpoint, keys, expirationTime }
}

export async function listPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const db = getFirebaseAdminFirestore()
  if (!db) return [...memorySubscriptions.values()]
  const snap = await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).get()
  return snap.docs
    .map((doc) => normalizeSubscription(doc.data()))
    .filter((row): row is StoredPushSubscription => row != null)
}

export async function savePushSubscription(subscription: unknown): Promise<boolean> {
  const normalized = normalizeSubscription(subscription)
  if (!normalized) return false
  const db = getFirebaseAdminFirestore()
  if (!db) {
    memorySubscriptions.set(normalized.endpoint, normalized)
    return true
  }
  await db
    .collection(PUSH_SUBSCRIPTIONS_COLLECTION)
    .doc(encodeURIComponent(normalized.endpoint))
    .set(normalized, { merge: true })
  return true
}

export async function removePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const trimmed = endpoint.trim()
  if (!trimmed) return
  const db = getFirebaseAdminFirestore()
  if (!db) {
    memorySubscriptions.delete(trimmed)
    return
  }
  await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(encodeURIComponent(trimmed)).delete()
}
