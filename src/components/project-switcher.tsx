"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"

/**
 * When the user is on a project-scoped URL (/projects/[id] or /projects/[id]/...),
 * changing the workspace filter must also update the route. Otherwise the sidebar shows
 * one project while the main pane still renders another (URL-driven) project.
 */
function navigateForProjectSelection(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  value: string
) {
  if (value === ALL_PROJECTS_FILTER) {
    if (pathname === "/projects" || /^\/projects\/[^/]+/.test(pathname)) {
      router.push("/projects")
    }
    return
  }

  if (pathname === "/projects") {
    router.push(`/projects/${value}`)
    return
  }

  const match = pathname.match(/^\/projects\/([^/]+)(\/.*)?$/)
  if (!match) return

  const currentId = match[1]
  const suffix = match[2] ?? ""

  if (value === currentId) return

  router.push(`/projects/${value}${suffix}`)
}

export function ProjectSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const { projects, selectedProjectFilterId, setSelectedProjectFilterId } =
    useWorkspace()

  const current =
    selectedProjectFilterId === ALL_PROJECTS_FILTER
      ? null
      : projects.find((p) => p.id === selectedProjectFilterId)

  useEffect(() => {
    if (selectedProjectFilterId === ALL_PROJECTS_FILTER) return
    if (projects.some((p) => p.id === selectedProjectFilterId)) return
    setSelectedProjectFilterId(ALL_PROJECTS_FILTER)
  }, [projects, selectedProjectFilterId, setSelectedProjectFilterId])

  const triggerLabel =
    selectedProjectFilterId === ALL_PROJECTS_FILTER
      ? "All projects"
      : (current?.name ?? "All projects")

  return (
    <div className="border-b px-4 py-3 group-data-[collapsible=icon]:hidden">
      <Select
        value={selectedProjectFilterId}
        onValueChange={(v) => {
          if (v == null) return
          setSelectedProjectFilterId(v)
          navigateForProjectSelection(router, pathname, v)
        }}
      >
        <SelectTrigger className="w-full h-9 bg-background">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-3 h-3 rounded-full shrink-0 border border-border/50"
              style={{
                backgroundColor: current?.color ?? "var(--muted-foreground)",
              }}
            />
            <SelectValue placeholder="All projects">{triggerLabel}</SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_PROJECTS_FILTER}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground/40 shrink-0" />
              All projects
            </div>
          </SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0 border border-border/50"
                  style={{ backgroundColor: project.color }}
                />
                {project.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
