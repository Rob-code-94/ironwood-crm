"use client"

/**
 * Split layout pattern from https://www.assistant-ui.com/docs/ui/assistant-sidebar
 * — resizable main column + assistant thread column.
 */
import type { RefObject } from "react"
import { useState } from "react"
import type { PanelImperativeHandle } from "react-resizable-panels"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Thread } from "@/components/assistant-ui/thread"

type AssistantSidebarProps = {
  children: React.ReactNode
  assistantPanelRef: RefObject<PanelImperativeHandle | null>
}

const PANEL_SIZE_KEY = "crm-assistant-panel-size"
const DEFAULT_PANEL_SIZE = 32

export function AssistantSidebar({
  children,
  assistantPanelRef,
}: AssistantSidebarProps) {
  const [defaultSize] = useState(() => {
    // Safely read localStorage during client-side initialization only
    if (typeof window === "undefined") return DEFAULT_PANEL_SIZE
    const saved = localStorage.getItem(PANEL_SIZE_KEY)
    if (saved) return Math.max(22, Math.min(78, parseFloat(saved)))
    return DEFAULT_PANEL_SIZE
  })

  const handleLayoutChange = (sizes: number[]) => {
    // Save the assistant panel size (second panel)
    if (sizes[1] > 0) localStorage.setItem(PANEL_SIZE_KEY, sizes[1].toString())
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex h-full min-h-0 min-w-0 w-full flex-1 [&_[data-panel]]:transition-all [&_[data-panel]]:duration-300 [&_[data-panel]]:ease-in-out"
      resizeTargetMinimumSize={{ coarse: 32, fine: 16 }}
      onLayout={handleLayoutChange}
    >
      <ResizablePanel
        id="dashboard-main"
        defaultSize={100 - defaultSize}
        minSize={38}
        className="flex min-h-0 min-w-0 flex-col"
      >
        {children}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="w-2 max-w-2 shrink-0 border-0 bg-transparent px-0 after:w-4"
      />
      <ResizablePanel
        id="crm-assistant-sidebar"
        panelRef={assistantPanelRef}
        defaultSize={defaultSize}
        minSize={22}
        collapsible
        collapsedSize={0}
        className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border/80 bg-background"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-2 pt-2 pb-2">
          <Thread />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
