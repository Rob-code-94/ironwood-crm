import type { DocumentType } from "@/lib/types"

/** Keep previews small so localStorage snapshot stays under typical quota. */
const MAX_PREVIEW_BYTES = 400_000

const IMAGE_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "avif",
  "bmp",
  "svg",
])

export function documentTypeFromFileName(fileName: string): DocumentType {
  const ext = fileName.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "pdf"
  if (ext && IMAGE_EXT.has(ext)) return "image"
  if (["xls", "xlsx", "csv"].includes(ext ?? "")) return "spreadsheet"
  if (["doc", "docx"].includes(ext ?? "")) return "document"
  return "other"
}

/** Data URL for small images only; returns undefined on failure or non-image / large files. */
export function maybeImagePreviewDataUrl(
  file: File,
  type: DocumentType
): Promise<string | undefined> {
  if (type !== "image") return Promise.resolve(undefined)
  if (file.size > MAX_PREVIEW_BYTES) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result
      resolve(typeof s === "string" ? s : undefined)
    }
    r.onerror = () => resolve(undefined)
    r.readAsDataURL(file)
  })
}
