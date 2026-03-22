"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  FolderOpen,
  Users,
  CalendarBlank,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { CreateProjectModal } from "@/components/create-project-modal"
import { useWorkspace } from "@/lib/workspace/context"
import type { ProjectLifecycleStatus } from "@/lib/types"

const statusColor: Record<ProjectLifecycleStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  planning: "secondary",
  completed: "outline",
  archived: "outline",
}

function lifecycle(p: { status?: ProjectLifecycleStatus }): ProjectLifecycleStatus {
  return p.status ?? "active"
}

export default function ProjectsPage() {
  const { projects } = useWorkspace()
  const [activeTab, setActiveTab] = useState("all")

  const filteredProjects = useMemo(() => {
    if (activeTab === "active") return projects.filter((p) => lifecycle(p) === "active")
    if (activeTab === "planning") return projects.filter((p) => lifecycle(p) === "planning")
    if (activeTab === "completed") return projects.filter((p) => lifecycle(p) === "completed")
    return projects
  }, [projects, activeTab])

  const counts = useMemo(
    () => ({
      all: projects.length,
      active: projects.filter((p) => lifecycle(p) === "active").length,
      planning: projects.filter((p) => lifecycle(p) === "planning").length,
      completed: projects.filter((p) => lifecycle(p) === "completed").length,
    }),
    [projects]
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage and organize all your projects</p>
        </div>
        <CreateProjectModal />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2">
              {counts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
            <Badge variant="secondary" className="ml-2">
              {counts.active}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="planning">
            Planning
            <Badge variant="secondary" className="ml-2">
              {counts.planning}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            <Badge variant="secondary" className="ml-2">
              {counts.completed}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const st = lifecycle(project)
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                            <CardTitle className="text-lg">{project.name}</CardTitle>
                          </div>
                          <p className="text-sm text-muted-foreground">{project.description}</p>
                        </div>
                        <Badge variant={statusColor[st]} className="capitalize shrink-0">
                          {st}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span className="text-muted-foreground">{project.progress ?? 0}%</span>
                        </div>
                        <Progress value={project.progress ?? 0} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          {project.members ?? 0} members
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarBlank size={14} />
                          {project.dueDate
                            ? new Date(project.dueDate).toLocaleDateString()
                            : "—"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {filteredProjects.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen size={48} className="text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects found in this category</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
