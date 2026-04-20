import { describe, expect, it } from "vitest"
import { emptyWorkspaceSnapshot, normalizeWorkspaceSnapshot } from "@/lib/workspace/persist"

describe("normalizeWorkspaceSnapshot", () => {
  it("round-trips emptyWorkspaceSnapshot", () => {
    const e = emptyWorkspaceSnapshot()
    expect(normalizeWorkspaceSnapshot(e)).toEqual(e)
  })

  it("rejects invalid payloads", () => {
    expect(normalizeWorkspaceSnapshot(null)).toBeNull()
    expect(normalizeWorkspaceSnapshot({ version: 2 })).toBeNull()
  })
})
