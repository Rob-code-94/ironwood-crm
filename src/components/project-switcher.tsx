"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"

export function ProjectSwitcher() {
  const { projects, selectedProjectFilterId, setSelectedProjectFilterId } =
    useWorkspace()

  const current =
    selectedProjectFilterId === ALL_PROJECTS_FILTER
      ? null
      : projects.find((p) => p.id === selectedProjectFilterId)

  return (
    <div className="border-b px-4 py-3 group-data-[collapsible=icon]:hidden">
      <Select
        value={selectedProjectFilterId}
        onValueChange={(v) => {
          if (v != null) setSelectedProjectFilterId(v)
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
            <SelectValue placeholder="All projects" />
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
