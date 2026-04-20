import { describe, expect, it } from "vitest"
import type { WorkspaceSnapshotV1 } from "@/lib/workspace/persist"

describe("workspace snapshot shape for outbox", () => {
  it("carries persistedAt for CAS", () => {
    const s: WorkspaceSnapshotV1 = {
      version: 1,
      projects: [],
      tasks: [],
      contacts: [],
      companies: [],
      deals: [],
      selectedProjectFilterId: "all",
      savedChatTurns: [],
      persistedAt: 1700000000000,
    }
    expect(typeof s.persistedAt).toBe("number")
  })
})
