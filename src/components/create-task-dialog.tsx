"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Priority, TaskStatus } from "@/lib/types"
import { useWorkspace } from "@/lib/workspace/context"
import { toast } from "sonner"
import { Plus, Trash } from "@phosphor-icons/react/dist/ssr"
import { DueDateQuickChips } from "@/components/due-date-quick-chips"
import { isoDateAddDaysFromToday } from "@/lib/due-date-utils"

type CreateTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
  defaultStatus?: TaskStatus
  /** When set (YYYY-MM-DD), pre-fills due date; overrides default offset from Settings. */
  defaultDueDate?: string
}

const priorities: Priority[] = ["low", "medium", "high", "urgent"]
const statuses: TaskStatus[] = ["todo", "in-progress", "review", "done"]

const emptyLink = () => ({ label: "", href: "" })

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultProjectId,
  defaultStatus: defaultStatusProp,
  defaultDueDate: defaultDueDateProp,
}: CreateTaskDialogProps) {
  const { projects, addTask, taskDefaultDueOffsetDays } = useWorkspace()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState<string>("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [dueDate, setDueDate] = useState("")
  const [assignee, setAssignee] = useState("")
  const [section, setSection] = useState("")
  const [tagsRaw, setTagsRaw] = useState("")
  const [sortOrder, setSortOrder] = useState("")
  const [linkRows, setLinkRows] = useState<{ label: string; href: string }[]>([emptyLink()])

  useEffect(() => {
    if (!open) return
    setProjectId(defaultProjectId ?? "")
    setStatus(defaultStatusProp ?? "todo")
    const pinned = defaultDueDateProp?.trim()
    if (pinned) {
      setDueDate(pinned)
    } else if (
      taskDefaultDueOffsetDays != null &&
      Number.isFinite(taskDefaultDueOffsetDays) &&
      taskDefaultDueOffsetDays >= 0
    ) {
      setDueDate(isoDateAddDaysFromToday(taskDefaultDueOffsetDays))
    } else {
      setDueDate("")
    }
  }, [open, defaultProjectId, defaultStatusProp, taskDefaultDueOffsetDays, defaultDueDateProp])

  function reset() {
    setTitle("")
    setDescription("")
    setProjectId(defaultProjectId ?? "")
    setPriority("medium")
    setStatus(defaultStatusProp ?? "todo")
    setDueDate("")
    setAssignee("")
    setSection("")
    setTagsRaw("")
    setSortOrder("")
    setLinkRows([emptyLink()])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const so = sortOrder.trim() === "" ? undefined : Number(sortOrder)
    const links = linkRows
      .filter((r) => r.label.trim() && r.href.trim())
      .map((r) => ({ label: r.label.trim(), href: r.href.trim() }))
    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      projectId: projectId || undefined,
      priority,
      status,
      dueDate: dueDate || undefined,
      assignee: assignee.trim() || undefined,
      section: section.trim() || undefined,
      tags: tags.length ? tags : undefined,
      sortOrder: Number.isFinite(so) ? so : undefined,
      links: links.length ? links : undefined,
    })
    toast.success("Task created")
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Add a task and optionally link it to a project, sections, and resources.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional details"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-section">Section</Label>
              <Input
                id="task-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Onboarding"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-sort">Sort order</Label>
              <Input
                id="task-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-tags">Tags</Label>
            <Input
              id="task-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="comma, separated, tags"
            />
          </div>
          <div className="space-y-2">
            <Label>Links</Label>
            <div className="space-y-2">
              {linkRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    placeholder="Label"
                    value={row.label}
                    onChange={(e) =>
                      setLinkRows((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r))
                      )
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder="https:// or tel:…"
                    value={row.href}
                    onChange={(e) =>
                      setLinkRows((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, href: e.target.value } : r))
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setLinkRows((rows) =>
                        rows.length > 1 ? rows.filter((_, j) => j !== i) : rows
                      )
                    }
                    disabled={linkRows.length <= 1}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setLinkRows((r) => [...r, emptyLink()])}
              >
                <Plus size={14} />
                Add link
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={projectId || "none"}
              onValueChange={(v) => {
                if (v != null) setProjectId(v === "none" ? "" : v)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => {
                  if (v != null) setPriority(v as Priority)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  if (v != null) setStatus(v as TaskStatus)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("-", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <DueDateQuickChips value={dueDate} onChange={setDueDate} />
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Input
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Create task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
