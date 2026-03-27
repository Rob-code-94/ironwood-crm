"use client"

/**
 * AssistantSidebar is now a simple layout passthrough.
 * The Thread renders inside AssistantModalPrimitive.Content in dashboard-inset-shell.tsx.
 */
export function AssistantSidebar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      {children}
    </div>
  )
}
