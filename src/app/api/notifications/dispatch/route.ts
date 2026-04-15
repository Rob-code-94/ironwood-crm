import { NextResponse } from "next/server"
import webpush from "web-push"
import {
  listPushSubscriptions,
  removePushSubscriptionByEndpoint,
} from "@/lib/notifications/push-subscriptions"

export const runtime = "nodejs"

type DispatchPayload = {
  title?: string
  body?: string
  tag?: string
  url?: string
}

export async function POST(req: Request) {
  let payload: DispatchPayload = {}
  try {
    payload = (await req.json()) as DispatchPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const title = payload.title?.trim()
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 422 })
  }
  const publicKey = process.env.IRONWOOD_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.IRONWOOD_VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.IRONWOOD_VAPID_SUBJECT?.trim() ?? "mailto:support@ironwoodplanner.app"

  if (!publicKey || !privateKey) {
    return NextResponse.json({
      ok: true,
      mode: "fallback-client",
      reason: "missing_vapid_keys",
      title,
      body: payload.body?.trim() ?? "",
    })
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)

  const subscriptions = await listPushSubscriptions()
  if (!subscriptions.length) {
    return NextResponse.json({
      ok: true,
      mode: "web-push",
      sent: 0,
      skipped: 0,
      reason: "no_subscribers",
    })
  }

  const message = JSON.stringify({
    title,
    body: payload.body?.trim() ?? "",
    tag: payload.tag?.trim() || "ironwood-reminder",
    url: payload.url?.trim() || "/tasks",
  })

  let sent = 0
  let removed = 0
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(subscription, message)
      sent += 1
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await removePushSubscriptionByEndpoint(subscription.endpoint)
        removed += 1
      }
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "web-push",
    sent,
    removed,
    total: subscriptions.length,
  })
}
