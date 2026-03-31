"use client"

import { useParams } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { useWorkspace } from "@/lib/workspace/context"

/**
 * Project detail and sub-routes are driven by the URL segment. Keep the workspace
 * filter in sync so the sidebar selector matches the page you are viewing.
 */
export default function ProjectIdLayout({ children }: { children: ReactNode }) {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const { setSelectedProjectFilterId } = useWorkspace()

  useEffect(() => {
    if (!id) return
    setSelectedProjectFilterId(id)
  }, [id, setSelectedProjectFilterId])

  return children
}
