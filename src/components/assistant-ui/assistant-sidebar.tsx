"use client"

/**
 * Split layout pattern from https://www.assistant-ui.com/docs/ui/assistant-sidebar
 * — resizable main column + assistant thread column.
 */
import type { RefObject } from "react"
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

export function AssistantSidebar({
  children,
  assistantPanelRef,
}: AssistantSidebarProps) {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex h-full min-h-0 min-w-0 w-full flex-1 [&_[data-panel]]:transition-all [&_[data-panel]]:duration-300 [&_[data-panel]]:ease-in-out"
      resizeTargetMinimumSize={{ coarse: 32, fine: 16 }}
    >
      <ResizablePanel
        id="dashboard-main"
        defaultSize={68}
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
        defaultSize={32}
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
