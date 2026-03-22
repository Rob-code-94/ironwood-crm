"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChatCircle, PaperPlaneTilt, Users, Clock } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"

interface Comment {
  id: string
  author: string
  avatar: string
  text: string
  timestamp: string
}

export function TeamCollaboration() {
  const { tasks } = useWorkspace()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")

  const teamMembers = useMemo(() => {
    const m = new Map<
      string,
      { tasksAssigned: number; sampleTask: string }
    >()
    for (const t of tasks) {
      const name = t.assignee?.trim()
      if (!name) continue
      if (!m.has(name)) m.set(name, { tasksAssigned: 0, sampleTask: t.title })
      const row = m.get(name)!
      row.tasksAssigned += 1
    }
    return Array.from(m.entries()).map(([name, v]) => ({
      id: name,
      name,
      role: "From task assignee field",
      avatar: name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      status: "online" as const,
      tasksAssigned: v.tasksAssigned,
    }))
  }, [tasks])

  const handleAddComment = () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: Date.now().toString(),
      author: "You",
      avatar: "YO",
      text: newComment,
      timestamp: "just now",
    }

    setComments((prev) => [...prev, comment])
    setNewComment("")
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            Team (from tasks)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No assignees yet. Add tasks and set an assignee name — they will list here.
            </p>
          ) : (
            teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>{member.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {member.tasksAssigned} tasks
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChatCircle size={18} />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-3">
          <div className="space-y-3 flex-1 max-h-[300px] overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No comments yet. This session only — not synced across refresh.
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {comment.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{comment.author}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock size={12} />
                        {comment.timestamp}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddComment()
              }}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="px-3"
            >
              <PaperPlaneTilt size={14} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
