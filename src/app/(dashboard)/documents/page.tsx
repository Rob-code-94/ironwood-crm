"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  UploadSimple,
  FilePdf,
  FileImage,
  FileXls,
  FileDoc,
  File,
  MagnifyingGlass,
  Trash,
} from "@phosphor-icons/react"
import { LoaderIcon } from "lucide-react"
import type { DocumentType } from "@/lib/types"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"
import { getStoredCrmAiModel } from "@/lib/crm-ai-settings"
import { documentTypeFromFileName, maybeImagePreviewDataUrl } from "@/lib/document-upload"
import {
  enqueueDocumentAnalysisJob,
  flushDocumentAnalysisQueue,
} from "@/lib/document-analysis-queue"
import { toast } from "sonner"

const FileIcon = ({ type }: { type: DocumentType }) => {
  const props = { size: 32 }
  switch (type) {
    case "pdf": return <FilePdf {...props} className="text-red-500" />
    case "image": return <FileImage {...props} className="text-blue-500" />
    case "spreadsheet": return <FileXls {...props} className="text-green-500" />
    case "document": return <FileDoc {...props} className="text-blue-600" />
    default: return <File {...props} className="text-muted-foreground" />
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const { projects, selectedProjectFilterId, documents, addDocument, deleteDocument, addTask } = useWorkspace()
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Document AI analysis state
  const [analysisState, setAnalysisState] = useState<"idle" | "analyzing" | "done" | "error">("idle")
  const [pendingAnalysis, setPendingAnalysis] = useState<{ extracted: string; fileName: string } | null>(null)
  const [creatingTasks, setCreatingTasks] = useState(false)

  useEffect(() => {
    if (selectedProjectFilterId !== ALL_PROJECTS_FILTER) {
      setProjectFilter(selectedProjectFilterId)
    }
  }, [selectedProjectFilterId])

  useEffect(() => {
    const run = () => {
      void flushDocumentAnalysisQueue((job, result) => {
        if (typeof result.extracted === "string") {
          setPendingAnalysis({ extracted: result.extracted, fileName: job.fileName })
          setAnalysisState("done")
          toast.success(`Analysis ready: ${job.fileName}`)
        }
      })
    }
    window.addEventListener("online", run)
    void run()
    return () => window.removeEventListener("online", run)
  }, [])

  const effectiveProjectFilter =
    selectedProjectFilterId !== ALL_PROJECTS_FILTER
      ? selectedProjectFilterId
      : projectFilter

  const filtered = documents.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchProject =
      effectiveProjectFilter === "all" || d.projectId === effectiveProjectFilter
    return matchSearch && matchProject
  })

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const fileArray = Array.from(files)
    for (const file of fileArray) {
      const type = documentTypeFromFileName(file.name)
      const previewDataUrl = await maybeImagePreviewDataUrl(file, type)
      const pid =
        effectiveProjectFilter !== "all" ? effectiveProjectFilter : undefined
      addDocument({
        name: file.name,
        url: null,
        size: file.size,
        type,
        uploadedAt: new Date().toISOString().split("T")[0],
        ...(previewDataUrl ? { previewDataUrl } : {}),
        ...(pid
          ? {
              projectId: pid,
              projectName: projects.find((p) => p.id === pid)?.name,
            }
          : {}),
      })
    }

    // Auto-analyze the first file with Gemini (queue when offline)
    const firstFile = fileArray[0]
    if (!firstFile) return
    setAnalysisState("analyzing")
    setPendingAnalysis(null)
    const instructions =
      "List all concrete action items, tasks, phases, and deliverables with any dates or deadlines mentioned. Be specific and detailed."
    const model = getStoredCrmAiModel()
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueDocumentAnalysisJob({ file: firstFile, instructions, model })
        setAnalysisState("idle")
        toast.info("You’re offline — document analysis is queued and will run when you’re back online.")
        return
      }
      const fd = new FormData()
      fd.set("file", firstFile)
      fd.set("instructions", instructions)
      fd.set("model", model)
      const res = await fetch("/api/process-file", { method: "POST", body: fd })
      const data = (await res.json()) as { extracted?: string; error?: string }
      if (res.ok && typeof data.extracted === "string") {
        setPendingAnalysis({ extracted: data.extracted, fileName: firstFile.name })
        setAnalysisState("done")
      } else {
        setAnalysisState("error")
      }
    } catch {
      try {
        await enqueueDocumentAnalysisJob({ file: firstFile, instructions, model })
        setAnalysisState("idle")
        toast.info("Analysis queued — will retry when the connection is stable.")
      } catch {
        setAnalysisState("error")
      }
    }
  }

  async function createTasksFromAnalysis() {
    if (!pendingAnalysis) return
    setCreatingTasks(true)
    try {
      const res = await fetch("/api/execute-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `Create tasks from this document analysis of "${pendingAnalysis.fileName}":\n\n${pendingAnalysis.extracted}`,
          commandType: "create-tasks",
          model: getStoredCrmAiModel(),
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        tasks?: { title: string; description?: string; dueDate?: string }[]
      }
      if (data.success && Array.isArray(data.tasks)) {
        const projectId =
          effectiveProjectFilter !== "all" ? effectiveProjectFilter : undefined
        for (const t of data.tasks) {
          addTask({
            title: t.title,
            description: t.description,
            priority: "medium",
            dueDate: t.dueDate,
            projectId,
          })
        }
        setPendingAnalysis(null)
        setAnalysisState("idle")
      }
    } catch {
      // Keep state so user can retry
    } finally {
      setCreatingTasks(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">{documents.length} files uploaded</p>
          {selectedProjectFilterId !== ALL_PROJECTS_FILTER && (
            <p className="text-xs text-muted-foreground mt-1">
              Sidebar filter:{" "}
              <span className="font-medium text-foreground">
                {projects.find((p) => p.id === selectedProjectFilterId)?.name}
              </span>
            </p>
          )}
        </div>
        <Button onClick={() => inputRef.current?.click()}>
          <UploadSimple size={16} className="mr-2" />
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.avif"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {/* Drop Zone */}
      <div
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <UploadSimple size={32} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Drag & drop files here</p>
        <p className="text-xs text-muted-foreground mt-1">or click Upload above</p>
        <p className="text-xs text-muted-foreground mt-3 max-w-md mx-auto">
          Files are kept as name, size, and an optional local thumbnail—full PDFs/images are not uploaded to
          a server. Keep originals on your device.
        </p>
      </div>

      {/* AI Analysis Panel */}
      {analysisState === "analyzing" && (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground flex items-center gap-2">
          <LoaderIcon className="size-4 animate-spin shrink-0" />
          Analyzing document with Gemini…
        </div>
      )}
      {analysisState === "done" && pendingAnalysis && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-sm">AI Analysis: {pendingAnalysis.fileName}</p>
            <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-48 overflow-auto rounded-md bg-muted/30 p-2">
              {pendingAnalysis.extracted}
            </pre>
            <div className="flex gap-2">
              <Button size="sm" onClick={createTasksFromAnalysis} disabled={creatingTasks}>
                {creatingTasks ? "Creating tasks…" : "Create tasks from this"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setPendingAnalysis(null); setAnalysisState("idle") }}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {analysisState === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Document analysis failed. Check that your Gemini API key is set in Assistant settings.</span>
          <Button size="sm" variant="ghost" onClick={() => setAnalysisState("idle")}>Dismiss</Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search documents..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          value={projectFilter}
          onValueChange={(v) => {
            if (v != null) setProjectFilter(v)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* File List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No documents found.
            </CardContent>
          </Card>
        ) : (
          filtered.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center gap-4 py-3">
                {doc.previewDataUrl ? (
                  <img
                    src={doc.previewDataUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <FileIcon type={doc.type} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(doc.size)} · {doc.uploadedAt}
                    {doc.projectName && (
                      <> · <Badge variant="outline" className="text-xs ml-1">{doc.projectName}</Badge></>
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteDocument(doc.id)}>
                  <Trash size={16} className="text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
