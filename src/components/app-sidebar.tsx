"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { ProjectSwitcher } from "@/components/project-switcher"
import { useWorkspace } from "@/lib/workspace/context"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  RiGalleryLine,
  RiPulseLine,
  RiCommandLine,
  RiTerminalBoxLine,
  RiRobotLine,
  RiBookOpenLine,
  RiSettingsLine,
  RiPieChartLine,
  RiToolsLine,
  RiChatSmileAiLine,
} from "@remixicon/react"

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: (
        <RiGalleryLine />
      ),
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: (
        <RiPulseLine />
      ),
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: (
        <RiCommandLine />
      ),
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: RiGalleryLine,
      isActive: true,
      items: [
        {
          title: "Overview",
          url: "/",
        },
        {
          title: "Analytics",
          url: "/analytics",
        },
      ],
    },
    {
      title: "Assistant",
      url: "/chat",
      icon: RiChatSmileAiLine,
      items: [
        {
          title: "CRM AI chat",
          url: "/chat",
        },
        {
          title: "AI Settings",
          url: "/assistant/settings",
        },
        {
          title: "Advisor",
          url: "/tools/advisor",
        },
      ],
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: RiTerminalBoxLine,
      items: [
        {
          title: "All Tasks",
          url: "/tasks",
        },
        {
          title: "Board View",
          url: "/tasks/board",
        },
        {
          title: "My Tasks",
          url: "/tasks?filter=my",
        },
        {
          title: "Assigned",
          url: "/tasks?filter=assigned",
        },
      ],
    },
    {
      title: "Projects",
      url: "/projects",
      icon: RiPieChartLine,
      items: [
        {
          title: "All Projects",
          url: "/projects",
        },
        {
          title: "Active",
          url: "/projects?status=active",
        },
        {
          title: "Completed",
          url: "/projects?status=completed",
        },
      ],
    },
    {
      title: "Documents",
      url: "/documents",
      icon: RiBookOpenLine,
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: RiCommandLine,
    },
    {
      title: "Tools",
      url: "/tools/calculator",
      icon: RiToolsLine,
      items: [
        { title: "Calculator", url: "/tools/calculator" },
        { title: "Reference", url: "/tools/reference" },
        { title: "Advisor", url: "/tools/advisor" },
      ],
    },
    {
      title: "CRM",
      url: "/crm",
      icon: RiRobotLine,
      items: [
        {
          title: "Overview",
          url: "/crm",
        },
        {
          title: "Contacts",
          url: "/crm/contacts",
        },
        {
          title: "Companies",
          url: "/crm/companies",
        },
        {
          title: "Deals",
          url: "/crm/deals",
        },
      ],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: RiSettingsLine,
      items: [
        {
          title: "Profile",
          url: "/settings",
        },
        {
          title: "Notifications",
          url: "/settings?tab=notifications",
        },
        {
          title: "Appearance",
          url: "/settings?tab=appearance",
        },
      ],
    },
  ],
}

function makeProjectIcon(color: string) {
  return function ProjectIcon({ className }: { className?: string }) {
    return (
      <span
        className={cn("size-4 shrink-0 rounded-full border border-border/50", className)}
        style={{ backgroundColor: color }}
        aria-hidden
      />
    )
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { projects } = useWorkspace()
  const navProjectItems = React.useMemo(
    () =>
      projects.slice(0, 5).map((p) => ({
        name: p.name,
        url: `/projects/${p.id}`,
        icon: makeProjectIcon(p.color),
      })),
    [projects]
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <ProjectSwitcher />
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={navProjectItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
