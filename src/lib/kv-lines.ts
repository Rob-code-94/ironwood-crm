/** Parse "key: value" lines into a flat record (generic metadata / labels). */
export function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const t = line.trim()
    if (!t) continue
    const i = t.indexOf(":")
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim()
    if (k) out[k] = v
  }
  return out
}

export function recordToKeyValueLines(r: Record<string, string> | undefined): string {
  if (!r || !Object.keys(r).length) return ""
  return Object.entries(r)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
}
