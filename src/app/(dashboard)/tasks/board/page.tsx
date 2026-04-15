"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KanbanBoard } from "@/components/kanban-board"
import { TeamCollaboration } from "@/components/team-collaboration"
import { GridFour, Users } from "@phosphor-icons/react/dist/ssr"

export default function TaskBoardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Task Board</h1>
        <p className="text-muted-foreground mt-1">Visualize and manage tasks with Kanban view and team collaboration</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <GridFour size={16} />
            <span className="hidden sm:inline">Kanban Board</span>
            <span className="sm:hidden">Kanban</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users size={16} />
            <span className="hidden sm:inline">Team Collaboration</span>
            <span className="sm:hidden">Team</span>
          </TabsTrigger>
        </TabsList>

        {/* Kanban Tab */}
        <TabsContent value="kanban" className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <KanbanBoard />
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <TeamCollaboration />
        </TabsContent>
      </Tabs>
    </div>
  )
}
