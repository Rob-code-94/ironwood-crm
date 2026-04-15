"use client"

import { useCallback, useEffect, startTransition, useState } from "react"
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
import { TaskStatusSelect } from "@/components/task-status-select"
import { useWorkspace } from "@/lib/workspace/context"
import type { Priority, Task, TaskStatus } from "@/lib/types"
import { toast } from "sonner"
import { Plus, Trash } from "@phosphor-icons/react/dist/ssr"
import { DueDateQuickChips } from "@/components/due-date-quick-chips"
import { ReminderControls } from "@/components/reminder-controls"

type TaskDetailDialogProps = {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const priorities: Priority[] = ["low", "medium", "high", "urgent"]

const emptyLink = () => ({ label: "", href: "" })

function hydrateFromTask(t: Task) {
  return {
    title: t.title,
    description: t.description ?? "",
    section: t.section ?? "",
    dueDate: t.dueDate ?? "",
    priority: t.priority,
    status: t.status,
    assignee: t.assignee ?? "",
    tagsRaw: (t.tags ?? []).join(", "),
    sortOrder: t.sortOrder != null ? String(t.sortOrder) : "",
    projectId: t.projectId ?? "",
    reminderMinutesBefore: t.reminders?.[0]?.minutesBefore ?? 60,
    recurrence: (t.recurrence?.frequency ?? "none") as "none" | "daily" | "weekly" | "monthly",
    inviteesRaw: (t.invitees ?? []).map((x) => x.email).join(", "),
    linkRows:
      t.links?.length && t.links.some((l) => l.label.trim() || l.href.trim())
        ? t.links.map((l) => ({ label: l.label, href: l.href }))
        : [emptyLink()],
  }
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const { updateTask, deleteTask, projects } = useWorkspace()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [section, setSection] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [assignee, setAssignee] = useState("")
  const [tagsRaw, setTagsRaw] = useState("")
  const [sortOrder, setSortOrder] = useState("")
  const [projectId, setProjectId] = useState("")
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(60)
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none")
  const [inviteesRaw, setInviteesRaw] = useState("")
  const [linkRows, setLinkRows] = useState<{ label: string; href: string }[]>([emptyLink()])

  const resetFromTask = useCallback((t: Task) => {
    const h = hydrateFromTask(t)
    setTitle(h.title)
    setDescription(h.description)
    setSection(h.section)
    setDueDate(h.dueDate)
    setPriority(h.priority)
    setStatus(h.status)
    setAssignee(h.assignee)
    setTagsRaw(h.tagsRaw)
    setSortOrder(h.sortOrder)
    setProjectId(h.projectId)
    setReminderMinutesBefore(h.reminderMinutesBefore)
    setRecurrence(h.recurrence)
    setInviteesRaw(h.inviteesRaw)
    setLinkRows(h.linkRows)
  }, [])

  useEffect(() => {
    if (!open || !task) return
    startTransition(() => {
      resetFromTask(task)
    })
  }, [open, task, resetFromTask])

  const handleSave = () => {
    if (!task) return
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const so = sortOrder.trim() === "" ? undefined : Number(sortOrder)
    const links = linkRows
      .filter((r) => r.label.trim() && r.href.trim())
      .map((r) => ({ label: r.label.trim(), href: r.href.trim() }))
    const invitees = inviteesRaw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      section: section.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      priority,
      status,
      assignee: assignee.trim() || undefined,
      tags: tags.length ? tags : undefined,
      sortOrder: Number.isFinite(so) ? so : undefined,
      links: links.length ? links : undefined,
      projectId: projectId.trim() || undefined,
      reminders: [
        {
          id: task.reminders?.[0]?.id ?? crypto.randomUUID(),
          minutesBefore: reminderMinutesBefore,
          channels: ["in_app", "push"],
        },
      ],
      recurrence: recurrence === "none" ? undefined : { frequency: recurrence },
      invitees: invitees.length
        ? invitees.map((email, idx) => ({
            id: task.invitees?.[idx]?.id ?? crypto.randomUUID(),
            email,
            status: "pending",
          }))
        : undefined,
    })
    toast.success("Task saved")
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (!task) return
    if (!window.confirm(`Delete “${task.title}”?`)) return
    deleteTask(task.id)
    toast.success("Task deleted")
    onOpenChange(false)
  }

  return (
    <Dialog open={Boolean(task && open)} onOpenChange={onOpenChange}>
      {task ? (
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14 text-left">
            <DialogTitle className="text-lg leading-snug">Edit task</DialogTitle>
            <DialogDescription>Change fields below, then save or delete.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-task-title">Title</Label>
                <Input
                  id="edit-task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-task-desc">Description</Label>
                <Textarea
                  id="edit-task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Details, notes, context…"
                  className="min-h-[100px] resize-y"
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
                        className="flex-1 min-w-0"
                      />
                      <Input
                        placeholder="https:// or tel:…"
                        value={row.href}
                        onChange={(e) =>
                          setLinkRows((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, href: e.target.value } : r))
                          )
                        }
                        className="flex-1 min-w-0"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-task-section">Section</Label>
                  <Input
                    id="edit-task-section"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Broker Applications"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-task-sort">Sort order</Label>
                  <Input
                    id="edit-task-sort"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-task-tags">Tags</Label>
                <Input
                  id="edit-task-tags"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="comma, separated, tags"
                />
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
                  <SelectContent side="top" align="start">
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    <SelectContent side="top" align="start">
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
                  <TaskStatusSelect
                    value={status}
                    onChange={setStatus}
                    contentSide="top"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-task-due">Due date</Label>
                  <Input
                    id="edit-task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <DueDateQuickChips value={dueDate} onChange={setDueDate} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-task-assignee">Assignee</Label>
                  <Input
                    id="edit-task-assignee"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Name"
                  />
                </div>
              </div>
              <ReminderControls
                minutesBefore={reminderMinutesBefore}
                onMinutesBeforeChange={setReminderMinutesBefore}
                recurrence={recurrence}
                onRecurrenceChange={setRecurrence}
                inviteesRaw={inviteesRaw}
                onInviteesRawChange={setInviteesRaw}
              />
            </div>
          </div>

          <footer className="flex shrink-0 flex-col gap-3 border-t bg-muted/72 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              Delete task
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={!title.trim()}>
                Save changes
              </Button>
            </div>
          </footer>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
