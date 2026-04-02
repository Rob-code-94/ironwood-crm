"use client"

import { useCallback, useState, type ComponentProps } from "react"
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/lib/workspace/context"
import { downloadPlaybookPdf } from "@/lib/playbook-pdf"
import { toast } from "sonner"

export function PlaybookPdfDownload({
  projectId,
  projectName,
  variant = "outline",
  className,
}: {
  projectId: string
  projectName: string
  variant?: ComponentProps<typeof Button>["variant"]
  className?: string
}) {
  const { tasks, projects } = useWorkspace()
  const [busy, setBusy] = useState(false)

  const onClick = useCallback(() => {
    setBusy(true)
    void (async () => {
      try {
        const projectDueDate = projects.find((p) => p.id === projectId)?.dueDate
        await downloadPlaybookPdf(projectName, projectId, tasks, { projectDueDate })
        toast.success("Playbook PDF downloaded")
      } catch (e) {
        console.error(e)
        toast.error("Could not create PDF")
      } finally {
        setBusy(false)
      }
    })()
  }, [projectId, projectName, projects, tasks])

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      disabled={busy}
      onClick={onClick}
    >
      <DownloadSimple size={16} className="mr-1.5" />
      {busy ? "Preparing…" : "Download PDF"}
    </Button>
  )
}
