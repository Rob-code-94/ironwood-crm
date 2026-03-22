"use client"

import { useEffect } from "react"
import { ChatInterface } from "@/components/ChatInterface"
import { useAssistantPanel } from "@/components/dashboard-inset-shell"

export default function CrmChatPage() {
  const { expandPanel } = useAssistantPanel()

  useEffect(() => {
    expandPanel()
  }, [expandPanel])

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col p-4 sm:p-6">
      <ChatInterface />
    </div>
  )
}
