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
import type { Document, DocumentType } from "@/lib/types"
import { seedDocuments } from "@/lib/workspace/seed"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"

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
  const { projects, selectedProjectFilterId } = useWorkspace()
  const [docs, setDocs] = useState<Document[]>(() => [...seedDocuments])
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selectedProjectFilterId !== ALL_PROJECTS_FILTER) {
      setProjectFilter(selectedProjectFilterId)
    }
  }, [selectedProjectFilterId])

  const effectiveProjectFilter =
    selectedProjectFilterId !== ALL_PROJECTS_FILTER
      ? selectedProjectFilterId
      : projectFilter

  const filtered = docs.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchProject =
      effectiveProjectFilter === "all" || d.projectId === effectiveProjectFilter
    return matchSearch && matchProject
  })

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase()
      const type: DocumentType =
        ext === "pdf" ? "pdf"
        : ["jpg", "jpeg", "png", "gif", "webp"].includes(ext ?? "") ? "image"
        : ["xls", "xlsx", "csv"].includes(ext ?? "") ? "spreadsheet"
        : ["doc", "docx"].includes(ext ?? "") ? "document"
        : "other"

      setDocs((prev) => [
        {
          id: String(Date.now()),
          name: file.name,
          url: URL.createObjectURL(file),
          size: file.size,
          type,
          uploadedAt: new Date().toISOString().split("T")[0],
        },
        ...prev,
      ])
    })
  }

  function removeDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">{docs.length} files uploaded</p>
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
          onChange={(e) => handleFiles(e.target.files)}
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
      </div>

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
                <FileIcon type={doc.type} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(doc.size)} · {doc.uploadedAt}
                    {doc.projectName && (
                      <> · <Badge variant="outline" className="text-xs ml-1">{doc.projectName}</Badge></>
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeDoc(doc.id)}>
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
