"use client"

import { useEffect } from "react"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"
import { useSetActiveClientId } from "@/components/iwc-assistant/active-client-context"

/**
 * Bridges current project filter into assistant context.
 * We use selected project ID as the active client/workspace context ID.
 */
export function ClientWorkspaceBridge() {
  const setActiveClientId = useSetActiveClientId()
  const { selectedProjectFilterId } = useWorkspace()

  useEffect(() => {
    if (!selectedProjectFilterId || selectedProjectFilterId === ALL_PROJECTS_FILTER) {
      setActiveClientId(null)
      return
    }
    setActiveClientId(selectedProjectFilterId)
  }, [selectedProjectFilterId, setActiveClientId])

  return null
}
