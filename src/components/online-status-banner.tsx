"use client"

import { useEffect, useState } from "react"
import { CloudSlash, ArrowsClockwise, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/lib/workspace/context"
import { isWorkspaceFileSyncEnabled } from "@/lib/workspace/persist"

/**
 * Slim banner when offline or when cloud workspace sync failed / is finishing.
 * CRM data stays in IndexedDB + memory; features that need /api/* wait until online.
 */
export function OnlineStatusBanner() {
  const [online, setOnline] = useState(true)
  const { workspaceSyncState, retryWorkspaceRemoteSync } = useWorkspace()

  useEffect(() => {
    const update = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  const syncOn = isWorkspaceFileSyncEnabled()
  const showSyncError = syncOn && online && workspaceSyncState === "error"
  const showSyncPending = syncOn && online && workspaceSyncState === "pending"

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300"
      >
        <CloudSlash size={14} />
        <span>
          Offline — your changes are saved locally (IndexedDB). Cloud sync, AI assistant, and
          uploads will resume when you reconnect.
        </span>
      </div>
    )
  }

  if (showSyncError) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-xs text-destructive"
      >
        <WarningCircle size={14} />
        <span>Cloud workspace sync failed. Your data is still saved on this device.</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => retryWorkspaceRemoteSync()}
        >
          Retry sync
        </Button>
      </div>
    )
  }

  if (showSyncPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 border-b border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs text-sky-800 dark:text-sky-200"
      >
        <ArrowsClockwise size={14} className="animate-pulse" />
        <span>Cloud sync queued — reconnecting or retrying…</span>
      </div>
    )
  }

  return null
}
