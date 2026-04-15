import { NextResponse } from "next/server"
import {
  removePushSubscriptionByEndpoint,
  savePushSubscription,
} from "@/lib/notifications/push-subscriptions"

export const runtime = "nodejs"

type SubscriptionPayload = {
  endpoint?: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export async function POST(req: Request) {
  let payload: SubscriptionPayload = {}
  try {
    payload = (await req.json()) as SubscriptionPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (!payload.endpoint?.trim()) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 422 })
  }

  const ok = await savePushSubscription(payload)
  if (!ok) {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 422 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  let payload: SubscriptionPayload = {}
  try {
    payload = (await req.json()) as SubscriptionPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  if (!payload.endpoint?.trim()) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 422 })
  }
  await removePushSubscriptionByEndpoint(payload.endpoint)
  return NextResponse.json({ ok: true })
}
