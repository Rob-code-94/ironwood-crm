"use client"

import { useEffect, useRef, useState, type FC } from "react"
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useThreadListItemRuntime,
} from "@assistant-ui/react"
import {
  ArchiveIcon,
  CheckIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

export const ThreadList: FC = () => {
  return (
    <ThreadListPrimitive.Root className="flex w-full flex-col gap-1">
      <ThreadListNew />
      <AuiIf condition={(s) => s.threads.isLoading}>
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf condition={(s) => !s.threads.isLoading}>
        <ThreadListPrimitive.Items>{() => <ThreadListItem />}</ThreadListPrimitive.Items>
      </AuiIf>
    </ThreadListPrimitive.Root>
  )
}

const ThreadListNew: FC = () => (
  <ThreadListPrimitive.New asChild>
    <Button variant="outline" className="h-9 justify-start gap-2 rounded-lg px-3 text-sm">
      <PlusIcon className="size-4" />
      New Thread
    </Button>
  </ThreadListPrimitive.New>
)

const ThreadListSkeleton: FC = () => (
  <div className="flex flex-col gap-1">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="flex h-9 items-center px-3">
        <Skeleton className="h-4 w-full" />
      </div>
    ))}
  </div>
)

const ThreadListItem: FC = () => {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState("")
  const runtime = useThreadListItemRuntime()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renaming])

  const startRename = () => {
    const title = runtime.getState().title ?? "New Chat"
    setDraft(title)
    setRenaming(true)
  }

  const commitRename = () => {
    const title = draft.trim()
    if (title) runtime.rename(title)
    setRenaming(false)
  }

  if (renaming) {
    return (
      <div className="flex h-9 items-center gap-1 rounded-lg bg-muted px-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename()
            if (e.key === "Escape") setRenaming(false)
          }}
          className="h-6 flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
        <button type="button" onClick={commitRename} className="text-green-600 hover:text-green-700">
          <CheckIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setRenaming(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <ThreadListItemPrimitive.Root className="group flex h-9 items-center gap-2 rounded-lg transition-colors hover:bg-muted data-active:bg-muted">
      <ThreadListItemPrimitive.Trigger className="flex h-full min-w-0 flex-1 items-center px-3 text-left text-sm">
        <span className="min-w-0 flex-1 truncate">
          <ThreadListItemPrimitive.Title fallback="New Chat" />
        </span>
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemMore onRename={startRename} />
    </ThreadListItemPrimitive.Root>
  )
}

const ThreadListItemMore: FC<{ onRename: () => void }> = ({ onRename }) => (
  <ThreadListItemMorePrimitive.Root>
    <ThreadListItemMorePrimitive.Trigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="mr-2 size-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 group-data-active:opacity-100"
      >
        <MoreHorizontalIcon className="size-4" />
        <span className="sr-only">More options</span>
      </Button>
    </ThreadListItemMorePrimitive.Trigger>
    <ThreadListItemMorePrimitive.Content
      side="bottom"
      align="start"
      className="z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <ThreadListItemMorePrimitive.Item
        className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onClick={onRename}
      >
        <PencilIcon className="size-4" />
        Rename
      </ThreadListItemMorePrimitive.Item>

      <ThreadListItemPrimitive.Archive asChild>
        <ThreadListItemMorePrimitive.Item className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
          <ArchiveIcon className="size-4" />
          Archive
        </ThreadListItemMorePrimitive.Item>
      </ThreadListItemPrimitive.Archive>

      <ThreadListItemPrimitive.Delete asChild>
        <ThreadListItemMorePrimitive.Item className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10 hover:text-destructive">
          <TrashIcon className="size-4" />
          Delete
        </ThreadListItemMorePrimitive.Item>
      </ThreadListItemPrimitive.Delete>
    </ThreadListItemMorePrimitive.Content>
  </ThreadListItemMorePrimitive.Root>
)
