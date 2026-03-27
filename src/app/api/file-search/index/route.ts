import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { randomUUID } from "crypto"

const STORE_KEY_MAX_AGE_MS = 1000 * 60 * 60 * 24 // 24h; purely a UX guard

type Body = {
  storeName?: string
}

export async function POST(req: Request) {
  const apiKey = getGoogleApiKeyFromRequest(req)
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini is not configured. Set GOOGLE_API_KEY or session key." },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const fileEntry = form.get("file")
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 })
  }

  const rawStoreName = form.get("storeName")
  const bodyStoreName = typeof rawStoreName === "string" ? rawStoreName : ""

  const rawDisplayName = form.get("displayName")
  const displayName =
    typeof rawDisplayName === "string" && rawDisplayName.trim() ? rawDisplayName.trim() : fileEntry.name

  const ai = new GoogleGenAI({ apiKey })

  const storeName =
    bodyStoreName && bodyStoreName.startsWith("fileSearchStores/")
      ? bodyStoreName
      : undefined

  let finalStoreName = storeName
  if (!finalStoreName) {
    const store = await ai.fileSearchStores.create({
      config: { displayName: `ironwood-file-search-${randomUUID()}` },
    })
    if (!store?.name) {
      return NextResponse.json({ error: "Failed to create file search store" }, { status: 502 })
    }
    finalStoreName = store.name
  }

  // Upload is a long-running operation. We return after it becomes "done" or
  // after a short timeout so the chat UI stays responsive.
  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    fileSearchStoreName: finalStoreName,
    file: fileEntry as globalThis.Blob,
    config: {
      displayName,
      mimeType: fileEntry.type || undefined,
    },
  })

  const start = Date.now()
  while (!operation?.done) {
    if (Date.now() - start > STORE_KEY_MAX_AGE_MS) break
    // Keep polling the operation status.
    operation = await ai.operations.get({ operation })
    if (operation?.done) break
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 800))
  }

  return NextResponse.json({
    storeName: finalStoreName,
    status: operation?.done ? "ready" : "processing",
    operationName: operation?.name,
  })
}

