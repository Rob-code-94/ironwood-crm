"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
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
  CaretRight,
  CheckSquare,
  Eye,
  EyeSlash,
  Files,
  Key,
  ListChecks,
  NotePencil,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { ProjectPlaybookPanel } from "@/components/project-playbook-panel"
import { PlaybookPdfDownload } from "@/components/playbook-pdf-download"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetTitle,
} from "@/components/ui/sheet"
import { TaskPriorityBadge } from "@/components/task-badges"
import { TaskStatusSelect } from "@/components/task-status-select"
import { ResourceLinks } from "@/components/resource-links"
import { parseKeyValueLines, recordToKeyValueLines } from "@/lib/kv-lines"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ProjectLifecycleStatus, ProjectNote, ProjectPasswordEntry } from "@/lib/types"
import { documentTypeFromFileName, maybeImagePreviewDataUrl } from "@/lib/document-upload"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const statusColor: Record<ProjectLifecycleStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  planning: "secondary",
  completed: "outline",
  archived: "outline",
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

const PROJECT_NOTE_BODY_MAX = 16_000

function projectNotePreview(note: ProjectNote): string {
  const t = note.title.trim()
  if (t) return t.length > 72 ? `${t.slice(0, 69)}…` : t
  const first = note.body.trim().split(/\n/)[0]?.trim() ?? ""
  if (first) return first.length > 72 ? `${first.slice(0, 69)}…` : first
  return "Untitled note"
}

function ProjectCustomFieldsCard({
  initialLines,
  onSave,
}: {
  initialLines: string
  onSave: (lines: string) => void
}) {
  const [draft, setDraft] = useState(initialLines)
  return (
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono text-sm"
            placeholder="External ID: ABC-123"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onSave(draft)
            toast.success("Custom fields saved")
          }}
        >
          Save custom fields
        </Button>
      </CardContent>
    </Card>
  )
}

export function ProjectDetailView() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const { projects, tasks, documents, addDocument, deleteDocument, updateProject, updateTask } =
    useWorkspace()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [passwordReveal, setPasswordReveal] = useState<Record<string, boolean>>({})
  const [passwordVaultOpen, setPasswordVaultOpen] = useState(false)
  const [editingPasswordEntryId, setEditingPasswordEntryId] = useState<string | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [tasksSheetOpen, setTasksSheetOpen] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id])

  /** One-time migration from legacy single textarea to structured entries */
  useEffect(() => {
    if (!project) return
    const legacy = project.passwordVault?.trim()
    if (!legacy || (project.passwordEntries?.length ?? 0) > 0) return
    startTransition(() => {
      updateProject(project.id, {
        passwordEntries: [
          { id: crypto.randomUUID(), label: "Imported notes", password: legacy },
        ],
        passwordVault: undefined,
      })
    })
  }, [
    project?.id,
    project?.passwordVault,
    project?.passwordEntries?.length,
    updateProject,
  ])

  const passwordEntries = project?.passwordEntries ?? []
  const projectNotes = useMemo(() => {
    const list = project?.notes ?? []
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [project?.notes])

  function patchProjectNote(
    noteId: string,
    patch: Partial<Pick<ProjectNote, "title" | "body">>
  ) {
    const list = project?.notes ?? []
    const next = list.map((n) =>
      n.id === noteId
        ? { ...n, ...patch, updatedAt: new Date().toISOString() }
        : n
    )
    updateProject(id, { notes: next.length ? next : undefined })
  }

  function addProjectNote() {
    const note: ProjectNote = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      updatedAt: new Date().toISOString(),
    }
    updateProject(id, { notes: [...(project?.notes ?? []), note] })
    setNotesOpen(true)
    setEditingNoteId(note.id)
  }

  function removeProjectNote(noteId: string) {
    if (!window.confirm("Delete this note?")) return
    const next = (project?.notes ?? []).filter((n) => n.id !== noteId)
    updateProject(id, { notes: next.length ? next : undefined })
    setEditingNoteId((cur) => (cur === noteId ? null : cur))
  }

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
    setPasswordVaultOpen(true)
    setEditingPasswordEntryId(entry.id)
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
    setEditingPasswordEntryId((cur) => (cur === entryId ? null : cur))
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
          onClick={() => setTasksSheetOpen(true)}
        >
          <CheckSquare size={16} />
          Tasks
        </Button>
      </div>

      <ProjectCustomFieldsCard
        key={project.id}
        initialLines={recordToKeyValueLines(project.customFields)}
        onSave={(draft) => {
          const parsed = parseKeyValueLines(draft)
          updateProject(id, {
            customFields: Object.keys(parsed).length ? parsed : undefined,
          })
        }}
      />

      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        <Card className="min-w-0 overflow-hidden md:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ListChecks size={18} />
                Playbook
              </CardTitle>
              <p className="text-xs text-muted-foreground font-normal mt-1">
                {projectTasks.filter((t) => t.status === "done").length}/{projectTasks.length}{" "}
                complete
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <PlaybookPdfDownload projectId={id} projectName={project.name} />
              <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                <Plus size={14} className="mr-1" />
                Add Task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <ProjectPlaybookPanel projectId={id} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          <Card className="overflow-hidden p-0 gap-0 shadow-none">
            <Collapsible
              open={notesOpen}
              onOpenChange={(open) => {
                setNotesOpen(open)
                if (!open) setEditingNoteId(null)
              }}
            >
              <CollapsibleTrigger
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors",
                  "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                )}
                title="Plain-text notes stored in your workspace"
              >
                <NotePencil size={16} className="shrink-0 text-muted-foreground" />
                <span className="font-medium">Notes</span>
                <span className="text-muted-foreground tabular-nums">
                  {projectNotes.length === 0 ? "—" : projectNotes.length}
                </span>
                <CaretRight
                  size={16}
                  className={cn(
                    "ml-auto shrink-0 text-muted-foreground transition-transform duration-200",
                    notesOpen && "rotate-90"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-[min(26rem,52vh)] space-y-2 overflow-y-auto border-t px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-full gap-1 sm:w-auto"
                    onClick={(e) => {
                      e.preventDefault()
                      addProjectNote()
                    }}
                  >
                    <Plus size={14} />
                    Add note
                  </Button>
                  {projectNotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      Jot meeting outcomes, links, or specs. Edits save as you type.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 pb-1">
                      {projectNotes.map((note) => {
                        const editing = editingNoteId === note.id
                        return (
                          <li
                            key={note.id}
                            className="overflow-hidden rounded-lg border bg-muted/15"
                          >
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                onClick={() =>
                                  setEditingNoteId(editing ? null : note.id)
                                }
                              >
                                <span className="truncate">{projectNotePreview(note)}</span>
                                <CaretRight
                                  size={14}
                                  className={cn(
                                    "ml-auto shrink-0 text-muted-foreground transition-transform",
                                    editing && "rotate-90"
                                  )}
                                />
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                aria-label="Delete note"
                                onClick={() => removeProjectNote(note.id)}
                              >
                                <Trash size={16} />
                              </Button>
                            </div>
                            {editing ? (
                              <div className="space-y-2 border-t bg-background/80 p-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`pn-title-${note.id}`} className="text-xs">
                                    Title
                                  </Label>
                                  <Input
                                    id={`pn-title-${note.id}`}
                                    placeholder="Short label"
                                    value={note.title}
                                    onChange={(e) =>
                                      patchProjectNote(note.id, { title: e.target.value })
                                    }
                                    maxLength={200}
                                    autoComplete="off"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`pn-body-${note.id}`} className="text-xs">
                                    Content
                                  </Label>
                                  <Textarea
                                    id={`pn-body-${note.id}`}
                                    placeholder="Write here…"
                                    value={note.body}
                                    onChange={(e) =>
                                      patchProjectNote(note.id, {
                                        body: e.target.value.slice(0, PROJECT_NOTE_BODY_MAX),
                                      })
                                    }
                                    rows={5}
                                    className="min-h-[5.5rem] resize-y text-sm"
                                    maxLength={PROJECT_NOTE_BODY_MAX}
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {note.body.length.toLocaleString()} /{" "}
                                  {PROJECT_NOTE_BODY_MAX.toLocaleString()} characters
                                </p>
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card className="flex h-72 min-w-0 flex-col overflow-hidden">
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
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.avif"
                onChange={async (e) => {
                  const list = e.target.files
                  if (!list?.length || !project) return
                  for (const file of Array.from(list)) {
                    const type = documentTypeFromFileName(file.name)
                    const previewDataUrl = await maybeImagePreviewDataUrl(file, type)
                    addDocument({
                      name: file.name,
                      url: null,
                      size: file.size,
                      type,
                      ...(previewDataUrl ? { previewDataUrl } : {}),
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
                      {doc.previewDataUrl ? (
                        <img
                          src={doc.previewDataUrl}
                          alt=""
                          className="size-10 shrink-0 rounded border object-cover"
                        />
                      ) : null}
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

          <Card className="overflow-hidden p-0 gap-0 shadow-none">
            <Collapsible
              open={passwordVaultOpen}
              onOpenChange={(open) => {
                setPasswordVaultOpen(open)
                if (!open) setEditingPasswordEntryId(null)
              }}
            >
              <CollapsibleTrigger
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors",
                  "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                )}
                title="Stored locally only, not encrypted — use a password manager for sensitive accounts"
              >
                <Key size={16} className="shrink-0 text-muted-foreground" />
                <span className="font-medium">Logins</span>
                <span className="text-muted-foreground tabular-nums">
                  {passwordEntries.length === 0 ? "—" : passwordEntries.length}
                </span>
                <CaretRight
                  size={16}
                  className={cn(
                    "ml-auto shrink-0 text-muted-foreground transition-transform duration-200",
                    passwordVaultOpen && "rotate-90"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-[min(22rem,48vh)] space-y-2 overflow-y-auto border-t px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-full gap-1 sm:w-auto"
                    onClick={(e) => {
                      e.preventDefault()
                      addPasswordEntry()
                    }}
                  >
                    <Plus size={14} />
                    Add login
                  </Button>
                  {passwordEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      Open this panel to add entries. Changes save as you type.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 pb-1">
                      {passwordEntries.map((entry) => {
                        const openHref = hrefFromUrlInput(entry.url ?? "")
                        const showPw = Boolean(passwordReveal[entry.id])
                        const editing = editingPasswordEntryId === entry.id
                        const title = entry.label?.trim() || "Untitled login"
                        return (
                          <li
                            key={entry.id}
                            className="overflow-hidden rounded-lg border bg-muted/15"
                          >
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                onClick={() =>
                                  setEditingPasswordEntryId(editing ? null : entry.id)
                                }
                              >
                                <span className="truncate">{title}</span>
                                <CaretRight
                                  size={14}
                                  className={cn(
                                    "ml-auto shrink-0 text-muted-foreground transition-transform",
                                    editing && "rotate-90"
                                  )}
                                />
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                aria-label="Remove this login"
                                onClick={() => removePasswordEntry(entry.id)}
                              >
                                <Trash size={16} />
                              </Button>
                            </div>
                            {editing ? (
                              <div className="space-y-2 border-t bg-background/80 p-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`pe-name-${entry.id}`} className="text-xs">
                                    Name
                                  </Label>
                                  <Input
                                    id={`pe-name-${entry.id}`}
                                    placeholder="e.g. CAQH ProView"
                                    value={entry.label ?? ""}
                                    onChange={(e) =>
                                      patchPasswordEntry(entry.id, { label: e.target.value })
                                    }
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
                                    onChange={(e) =>
                                      patchPasswordEntry(entry.id, { login: e.target.value })
                                    }
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
                                        patchPasswordEntry(entry.id, {
                                          password: e.target.value,
                                        })
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
                                      onChange={(e) =>
                                        patchPasswordEntry(entry.id, { url: e.target.value })
                                      }
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
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </div>

      <Sheet open={tasksSheetOpen} onOpenChange={setTasksSheetOpen}>
        <SheetContent
          side="right"
          className="flex h-full max-h-[100dvh] w-[min(100vw-1rem,56rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 p-0 sm:max-w-4xl"
        >
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <CheckSquare size={20} />
              Tasks
            </SheetTitle>
            <SheetDescription>
              Table view for {project.name} — click a row for details.
            </SheetDescription>
          </SheetHeader>
          <SheetPanel className="min-h-0 flex-1 px-6 py-4">
            <div className="mb-4 flex justify-end">
              <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                <Plus size={14} className="mr-1" />
                Add Task
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
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
          </SheetPanel>
        </SheetContent>
      </Sheet>

      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        defaultProjectId={id}
      />
      <TaskDetailDialog
        task={detailTask}
        open={detailTask !== null}
        onOpenChange={(next) => {
          if (!next) setDetailTaskId(null)
        }}
      />
    </div>
  )
}
