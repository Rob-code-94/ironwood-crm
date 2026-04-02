"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ListChecks } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { ProjectPlaybookPanel } from "@/components/project-playbook-panel"
import { PlaybookPdfDownload } from "@/components/playbook-pdf-download"

export function PlaybookView() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const { projects, tasks } = useWorkspace()

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id])

  const total = tasks.filter((t) => t.projectId === id).length
  const done = tasks.filter((t) => t.projectId === id && t.status === "done").length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

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
            Project not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <Link href={`/projects/${id}`}>
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowLeft size={16} className="mr-2" />
              Project
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ListChecks size={24} className="text-muted-foreground" />
              Playbook
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {project.name} · {done}/{total} complete ({pct}%)
            </p>
          </div>
        </div>
        <PlaybookPdfDownload projectId={id} projectName={project.name} className="shrink-0" />
      </div>

      <ProjectPlaybookPanel projectId={id} />
    </div>
  )
}
