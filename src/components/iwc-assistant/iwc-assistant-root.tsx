"use client"

import { useMemo } from "react"
import { AssistantRuntimeProvider } from "@assistant-ui/react"
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk"
import { AssistantModal } from "@/components/assistant-ui/assistant-modal"
import { useActiveClientId } from "@/components/iwc-assistant/active-client-context"

export function IwcAssistantRoot() {
  const clientId = useActiveClientId()

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/assistant/chat",
        prepareSendMessagesRequest: async (opts) => {
          const body = (opts.body ?? {}) as Record<string, unknown>
          const optsAny = opts as Record<string, unknown>

          return {
            body: {
              ...body,
              messages: optsAny.messages,
              id: optsAny.id,
              trigger: optsAny.trigger,
              messageId: optsAny.messageId,
              metadata: optsAny.requestMetadata,
              clientContextId: clientId ?? undefined,
            },
            headers: opts.headers as HeadersInit | undefined,
          }
        },
      }),
    [clientId]
  )

  const runtime = useChatRuntime({ transport })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantModal />
    </AssistantRuntimeProvider>
  )
}
