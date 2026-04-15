import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  const publicKey = process.env.IRONWOOD_VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) {
    return NextResponse.json(
      { error: "Missing IRONWOOD_VAPID_PUBLIC_KEY." },
      { status: 503 }
    )
  }
  return NextResponse.json({ publicKey })
}
