"use client"

import { useEffect, useMemo, useRef, useState, type FC } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useCrmAssistantUi } from "@/components/crm-assistant-provider"
import { cn } from "@/lib/utils"

export const ThreadList: FC = () => {
  const { savedThreads, startNewThread, activeThreadId, loadThread } = useCrmAssistantUi()
  const activeThreads = useMemo(
    () => savedThreads.filter((thread) => thread.status !== "archived"),
    [savedThreads]
  )

  return (
    <div className="flex w-full flex-col gap-1">
      <ThreadListNew onClick={startNewThread} />
      {activeThreads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          id={thread.id}
          title={thread.title}
          active={activeThreadId === thread.id}
          onLoad={() => loadThread(thread.id)}
        />
      ))}
      {activeThreads.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">No saved threads yet.</p>
      ) : null}
    </div>
  )
}

const ThreadListNew: FC<{ onClick: () => void }> = ({ onClick }) => (
  <Button
    variant="outline"
    className="h-9 justify-start gap-2 rounded-lg px-3 text-sm"
    onClick={onClick}
  >
      <PlusIcon className="size-4" />
      New Thread
  </Button>
)

const ThreadListItem: FC<{
  id: string
  title: string
  active: boolean
  onLoad: () => void
}> = ({ id, title, active, onLoad }) => {
  const { renameThread, archiveThread, deleteThread } = useCrmAssistantUi()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renaming])

  const startRename = () => {
    setDraft(title)
    setRenaming(true)
  }

  const commitRename = () => {
    const nextTitle = draft.trim()
    if (nextTitle) renameThread(id, nextTitle)
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
    <div
      className={cn(
        "group flex h-9 items-center gap-2 rounded-lg transition-colors hover:bg-muted",
        active ? "bg-muted" : ""
      )}
    >
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 items-center px-3 text-left text-sm"
        onClick={onLoad}
      >
        <span className="min-w-0 flex-1 truncate">
          {title || "New Chat"}
        </span>
      </button>
      <ThreadListItemMore
        onRename={startRename}
        onArchive={() => archiveThread(id)}
        onDelete={() => deleteThread(id)}
      />
    </div>
  )
}

const ThreadListItemMore: FC<{
  onRename: () => void
  onArchive: () => void
  onDelete: () => void
}> = ({ onRename, onArchive, onDelete }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 size-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 group-data-active:opacity-100"
        />
      }
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More options</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      side="bottom"
      align="start"
      className="z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <DropdownMenuItem
        className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onClick={onRename}
      >
        <PencilIcon className="size-4" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem
        className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onClick={onArchive}
      >
        <ArchiveIcon className="size-4" />
        Archive
      </DropdownMenuItem>
      <DropdownMenuItem
        className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
      >
        <TrashIcon className="size-4" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)
