"use client"

/**
 * AssistantSidebar is a layout passthrough for assistant UI when embedded in a parent layout.
 */
export function AssistantSidebar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      {children}
    </div>
  )
}
