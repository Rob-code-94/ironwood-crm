"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckSquare,
  FolderOpen,
  FileText,
  CalendarBlank,
  Users,
  Gear,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

export function DashboardTabs() {
  return (
    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList className="grid w-full grid-cols-6 border-b rounded-none h-auto bg-transparent p-0">
        <TabsTrigger
          value="dashboard"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <CheckSquare size={18} />
            Dashboard
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="tasks"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <CheckSquare size={18} />
            Tasks
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="projects"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <FolderOpen size={18} />
            Projects
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="documents"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <FileText size={18} />
            Documents
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="calendar"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <CalendarBlank size={18} />
            Calendar
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="crm"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <Users size={18} />
            CRM
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="p-6">
        <div className="text-sm text-muted-foreground">Dashboard content</div>
      </TabsContent>

      <TabsContent value="tasks" className="p-6">
        <div className="text-sm text-muted-foreground">Tasks content</div>
      </TabsContent>

      <TabsContent value="projects" className="p-6">
        <div className="text-sm text-muted-foreground">Projects content</div>
      </TabsContent>

      <TabsContent value="documents" className="p-6">
        <div className="text-sm text-muted-foreground">Documents content</div>
      </TabsContent>

      <TabsContent value="calendar" className="p-6">
        <div className="text-sm text-muted-foreground">Calendar content</div>
      </TabsContent>

      <TabsContent value="crm" className="p-6">
        <div className="text-sm text-muted-foreground">CRM content</div>
      </TabsContent>
    </Tabs>
  )
}
