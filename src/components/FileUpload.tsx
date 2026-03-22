"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getStoredCrmAiModel } from "@/lib/crm-ai-settings"
import { Upload } from "lucide-react"

export type FileAnalysisResult = {
  extracted: string
  fileName: string
  timestamp: string
}

type FileUploadProps = {
  onAnalyzed: (result: FileAnalysisResult, instructions: string) => void
  className?: string
}

export function FileUpload({ onAnalyzed, className }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [instructions, setInstructions] = useState(
    "What are the key action items and deadlines?"
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) {
      setFile(f)
      setError(null)
    }
  }, [])

  async function analyze() {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set("file", file)
      fd.set("instructions", instructions.trim() || "Summarize and list action items.")
      fd.set("model", getStoredCrmAiModel())
      const res = await fetch("/api/process-file", {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as FileAnalysisResult & { error?: string }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed")
        return
      }
      if (typeof data.extracted !== "string") {
        setError("Unexpected response")
        return
      }
      onAnalyzed(
        {
          extracted: data.extracted,
          fileName: data.fileName,
          timestamp: data.timestamp,
        },
        instructions.trim() || "Summarize and list action items."
      )
      setFile(null)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("space-y-3 rounded-xl border bg-muted/20 p-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Upload className="size-4 text-muted-foreground" aria-hidden />
        Document analysis
      </div>
      <div
        className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-background/50 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/30"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => document.getElementById("crm-file-input")?.click()}
        role="presentation"
      >
        {file ? (
          <span className="text-foreground">{file.name}</span>
        ) : (
          <span>Drop a file here or click to choose (PDF, images, text, etc.)</span>
        )}
        <Input
          id="crm-file-input"
          type="file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              setFile(f)
              setError(null)
            }
            e.target.value = ""
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="file-instructions">Instructions for the model</Label>
        <Textarea
          id="file-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" size="sm" onClick={analyze} disabled={!file || loading}>
        {loading ? "Analyzing…" : "Analyze with Gemini"}
      </Button>
    </div>
  )
}
