"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckSquare,
  Eye,
  EyeSlash,
  Files,
  Key,
  ListChecks,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { TaskPriorityBadge } from "@/components/task-badges"
import { TaskStatusSelect } from "@/components/task-status-select"
import { ResourceLinks } from "@/components/resource-links"
import { parseKeyValueLines, recordToKeyValueLines } from "@/lib/kv-lines"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { DocumentType, ProjectLifecycleStatus, ProjectPasswordEntry } from "@/lib/types"

const statusColor: Record<ProjectLifecycleStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  planning: "secondary",
  completed: "outline",
  archived: "outline",
}

function documentTypeFromName(fileName: string): DocumentType {
  const ext = fileName.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "pdf"
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext ?? "")) return "image"
  if (["xls", "xlsx", "csv"].includes(ext ?? "")) return "spreadsheet"
  if (["doc", "docx"].includes(ext ?? "")) return "document"
  return "other"
}

function formatDocSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function hrefFromUrlInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(t)) return `https://${t}`
  return t.startsWith("/") ? t : `https://${t}`
}

export function ProjectDetailView() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const { projects, tasks, documents, addDocument, deleteDocument, updateProject, updateTask } =
    useWorkspace()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [customFieldsDraft, setCustomFieldsDraft] = useState("")
  const [passwordReveal, setPasswordReveal] = useState<Record<string, boolean>>({})
  const docInputRef = useRef<HTMLInputElement>(null)

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id])

  useEffect(() => {
    if (project) setCustomFieldsDraft(recordToKeyValueLines(project.customFields))
  }, [project?.id])

  /** One-time migration from legacy single textarea to structured entries */
  useEffect(() => {
    if (!project) return
    const legacy = project.passwordVault?.trim()
    if (!legacy || (project.passwordEntries?.length ?? 0) > 0) return
    updateProject(project.id, {
      passwordEntries: [
        { id: crypto.randomUUID(), label: "Imported notes", password: legacy },
      ],
      passwordVault: undefined,
    })
  }, [
    project?.id,
    project?.passwordVault,
    project?.passwordEntries?.length,
    updateProject,
  ])

  const passwordEntries = project?.passwordEntries ?? []

  function patchPasswordEntry(
    entryId: string,
    patch: Partial<Pick<ProjectPasswordEntry, "label" | "login" | "password" | "url">>
  ) {
    const list = project?.passwordEntries ?? []
    const next = list.map((e) => (e.id === entryId ? { ...e, ...patch } : e))
    updateProject(id, { passwordEntries: next.length ? next : undefined })
  }

  function addPasswordEntry() {
    const entry: ProjectPasswordEntry = {
      id: crypto.randomUUID(),
      label: "",
      login: "",
      password: "",
      url: "",
    }
    updateProject(id, {
      passwordEntries: [...(project?.passwordEntries ?? []), entry],
    })
    toast.success("New login added — edit below")
  }

  function removePasswordEntry(entryId: string) {
    if (!window.confirm("Remove this saved login?")) return
    const next = (project?.passwordEntries ?? []).filter((e) => e.id !== entryId)
    updateProject(id, { passwordEntries: next.length ? next : undefined })
    setPasswordReveal((r) => {
      const next = { ...r }
      delete next[entryId]
      return next
    })
    toast.success("Login removed")
  }

  const projectDocuments = useMemo(
    () => documents.filter((d) => d.projectId === id),
    [documents, id]
  )

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === id),
    [tasks, id]
  )

  const detailTask = useMemo(
    () => (detailTaskId ? projectTasks.find((t) => t.id === detailTaskId) ?? null : null),
    [projectTasks, detailTaskId]
  )

  useEffect(() => {
    if (detailTaskId && !detailTask) setDetailTaskId(null)
  }, [detailTaskId, detailTask])

  if (!project) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} className="mr-2" />
            Projects
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Project not found. It may have been removed.
          </CardContent>
        </Card>
      </div>
    )
  }

  const st = project.status ?? "active"

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowLeft size={16} className="mr-2" />
              Projects
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="size-3 rounded-full shrink-0 border border-border/50"
                style={{ backgroundColor: project.color }}
              />
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={statusColor[st]} className="capitalize">
                {st}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          render={<Link href={`/projects/${id}/playbook`} />}
        >
          <ListChecks size={16} />
          Playbook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom fields</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Optional metadata for this project (IDs, codes, client name, etc.). Same format as when you
            create a project.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cf">
              One <code className="text-xs">name: value</code> per line
            </Label>
            <Textarea
              id="cf"
              rows={4}
              value={customFieldsDraft}
              onChange={(e) => setCustomFieldsDraft(e.target.value)}
              className="font-mono text-sm"
              placeholder="External ID: ABC-123"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const parsed = parseKeyValueLines(customFieldsDraft)
              updateProject(id, {
                customFields: Object.keys(parsed).length ? parsed : undefined,
              })
              toast.success("Custom fields saved")
            }}
          >
            Save custom fields
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare size={18} />
              Tasks
            </CardTitle>
            <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
              <Plus size={14} className="mr-1" />
              Add Task
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Task</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Section</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Priority</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
                        No tasks yet for this project.
                      </td>
                    </tr>
                  ) : (
                    projectTasks.map((task, i) => (
                      <tr
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailTaskId(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setDetailTaskId(task.id)
                          }
                        }}
                        className={cn(
                          i < projectTasks.length - 1 && "border-b",
                          "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{task.title}</div>
                          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                            <ResourceLinks links={task.links} compact />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                          {task.section?.trim() || "—"}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <TaskPriorityBadge priority={task.priority} />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div onClick={(e) => e.stopPropagation()}>
                            <TaskStatusSelect
                              size="compact"
                              value={task.status}
                              onChange={(status) => updateTask(task.id, { status })}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {task.dueDate ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          <Card className="flex h-72 flex-col overflow-hidden">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Files size={16} />
                Documents
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                onClick={() => docInputRef.current?.click()}
              >
                <Plus size={14} />
                Add
              </Button>
              <input
                ref={docInputRef}
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(e) => {
                  const list = e.target.files
                  if (!list?.length || !project) return
                  for (const file of Array.from(list)) {
                    addDocument({
                      name: file.name,
                      url: null,
                      size: file.size,
                      type: documentTypeFromName(file.name),
                      projectId: id,
                      projectName: project.name,
                      uploadedAt: new Date().toISOString().split("T")[0],
                    })
                  }
                  toast.success(list.length === 1 ? "Document added" : `${list.length} documents added`)
                  e.target.value = ""
                }}
              />
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
              {projectDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center px-4 py-8">
                  No documents for this project. Use Add or upload from the Documents page with this
                  project selected.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {projectDocuments.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDocSize(doc.size)} · {doc.uploadedAt}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${doc.name}`}
                        onClick={() => {
                          deleteDocument(doc.id)
                          toast.success("Document removed")
                        }}
                      >
                        <Trash size={16} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="flex max-h-[min(28rem,55vh)] flex-col overflow-hidden">
            <CardHeader className="shrink-0 space-y-2 border-b py-3">
              <div className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Key size={16} />
                    Passwords and logins
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                    Each entry saves as you type (stored locally, not encrypted). Use a password
                    manager for highly sensitive accounts.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  onClick={addPasswordEntry}
                >
                  <Plus size={14} />
                  Add password
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {passwordEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 px-2">
                  No saved logins yet. Click <span className="font-medium text-foreground">Add password</span>{" "}
                  to add a site name, login, password, and URL.
                </p>
              ) : (
                <ul className="space-y-4">
                  {passwordEntries.map((entry) => {
                    const openHref = hrefFromUrlInput(entry.url ?? "")
                    const showPw = Boolean(passwordReveal[entry.id])
                    return (
                      <li
                        key={entry.id}
                        className="rounded-xl border bg-muted/20 p-3 space-y-3 shadow-xs/5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Saved login
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground hover:text-destructive -mt-1 -me-1"
                            aria-label="Remove this login"
                            onClick={() => removePasswordEntry(entry.id)}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label htmlFor={`pe-name-${entry.id}`} className="text-xs">
                              Name
                            </Label>
                            <Input
                              id={`pe-name-${entry.id}`}
                              placeholder="e.g. CAQH ProView"
                              value={entry.label ?? ""}
                              onChange={(e) => patchPasswordEntry(entry.id, { label: e.target.value })}
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`pe-login-${entry.id}`} className="text-xs">
                              Login
                            </Label>
                            <Input
                              id={`pe-login-${entry.id}`}
                              placeholder="Email or username"
                              value={entry.login ?? ""}
                              onChange={(e) => patchPasswordEntry(entry.id, { login: e.target.value })}
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`pe-pw-${entry.id}`} className="text-xs">
                              Password
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id={`pe-pw-${entry.id}`}
                                type={showPw ? "text" : "password"}
                                placeholder="••••••••"
                                value={entry.password ?? ""}
                                onChange={(e) =>
                                  patchPasswordEntry(entry.id, { password: e.target.value })
                                }
                                className="min-w-0 flex-1 font-mono text-sm"
                                autoComplete="new-password"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                                aria-label={showPw ? "Hide password" : "Show password"}
                                onClick={() =>
                                  setPasswordReveal((r) => ({
                                    ...r,
                                    [entry.id]: !r[entry.id],
                                  }))
                                }
                              >
                                {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`pe-url-${entry.id}`} className="text-xs">
                              URL
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id={`pe-url-${entry.id}`}
                                type="url"
                                placeholder="https://…"
                                value={entry.url ?? ""}
                                onChange={(e) => patchPasswordEntry(entry.id, { url: e.target.value })}
                                className="min-w-0 flex-1"
                                autoComplete="off"
                              />
                              {openHref ? (
                                <a
                                  href={openHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open link"
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "icon" }),
                                    "shrink-0"
                                  )}
                                >
                                  <ArrowSquareOut size={18} />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        defaultProjectId={id}
      />
      <TaskDetailDialog
        task={detailTask}
        open={detailTaskId !== null}
        onOpenChange={(next) => {
          if (!next) setDetailTaskId(null)
        }}
      />
    </div>
  )
}
