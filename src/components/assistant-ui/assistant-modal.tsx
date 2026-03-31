"use client"

import { BotIcon, ChevronDownIcon } from "lucide-react"
import { type FC, forwardRef } from "react"
import { AssistantModalPrimitive } from "@assistant-ui/react"
import { Thread } from "@/components/assistant-ui/thread"
import { ThreadList } from "@/components/assistant-ui/thread-list"
import { Button } from "@/components/ui/button"

export const AssistantModal: FC = () => {
  return (
    <AssistantModalPrimitive.Root>
      <AssistantModalPrimitive.Anchor className="fixed bottom-4 right-4 z-50 size-11">
        <AssistantModalPrimitive.Trigger asChild>
          <AssistantModalButton />
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>

      <AssistantModalPrimitive.Content
        sideOffset={16}
        className="z-50 flex h-[min(85vh,600px)] w-[min(90vw,680px)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none"
      >
        <div className="hidden w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/30 p-2 sm:flex">
          <ThreadList />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Thread />
        </div>
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  )
}

type AssistantModalButtonProps = { "data-state"?: "open" | "closed" }

const AssistantModalButton = forwardRef<HTMLButtonElement, AssistantModalButtonProps>(
  ({ "data-state": state, ...rest }, ref) => {
    const open = state === "open"
    return (
      <Button
        ref={ref}
        {...rest}
        type="button"
        size="icon"
        className="size-11 rounded-full shadow-lg"
        aria-label={open ? "Close Assistant" : "Open Assistant"}
      >
        {open ? <ChevronDownIcon className="size-5" /> : <BotIcon className="size-5" />}
      </Button>
    )
  }
)

AssistantModalButton.displayName = "AssistantModalButton"
