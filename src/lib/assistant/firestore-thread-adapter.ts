"use client"

import type { RemoteThreadListAdapter } from "@assistant-ui/react"

async function apiFetch(path: string, options?: RequestInit) {
  return fetch(path, options)
}

export function createFirestoreThreadAdapter(): RemoteThreadListAdapter {
  return {
    list: async () => {
      try {
        const res = await apiFetch("/api/assistant/threads")
        if (!res.ok) return { threads: [] }
        return (await res.json()) as {
          threads: Array<{
            status: "regular" | "archived"
            remoteId: string
            title?: string
            externalId?: string
          }>
        }
      } catch {
        return { threads: [] }
      }
    },
    initialize: async (threadId) => {
      try {
        const res = await apiFetch("/api/assistant/threads", { method: "POST" })
        if (!res.ok) return { remoteId: threadId, externalId: undefined }
        const data = (await res.json()) as { remoteId: string; externalId: undefined }
        return { remoteId: data.remoteId, externalId: undefined }
      } catch {
        return { remoteId: threadId, externalId: undefined }
      }
    },
    fetch: async (threadId) => {
      try {
        const res = await apiFetch(`/api/assistant/threads/${threadId}`)
        if (!res.ok) throw new Error("Not found")
        return (await res.json()) as {
          status: "regular" | "archived"
          remoteId: string
          title?: string
          externalId?: string
        }
      } catch {
        return { status: "regular", remoteId: threadId }
      }
    },
    rename: async (remoteId, newTitle) => {
      await apiFetch(`/api/assistant/threads/${remoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      })
    },
    archive: async (remoteId) => {
      await apiFetch(`/api/assistant/threads/${remoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      })
    },
    unarchive: async (remoteId) => {
      await apiFetch(`/api/assistant/threads/${remoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "regular" }),
      })
    },
    delete: async (remoteId) => {
      await apiFetch(`/api/assistant/threads/${remoteId}`, { method: "DELETE" })
    },
    generateTitle: async () => new ReadableStream(),
  }
}
