"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/lib/workspace/context"
import { Wrench } from "@phosphor-icons/react/dist/ssr"

export function WorkspaceRepairCard() {
  const { repairWorkspaceFromRefs, workspaceRemoteLoading } = useWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench size={18} />
          Workspace data
        </CardTitle>
        <CardDescription>
          If tasks reference projects that no longer appear in the list, you can recreate minimal
          project rows from those links. Changes sync to your cloud workspace when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          disabled={workspaceRemoteLoading}
          onClick={() => repairWorkspaceFromRefs()}
        >
          Repair missing projects from links
        </Button>
      </CardContent>
    </Card>
  )
}
