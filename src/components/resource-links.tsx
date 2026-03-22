"use client"

import { LinkSimple } from "@phosphor-icons/react/dist/ssr"
import { cn } from "@/lib/utils"
import type { ResourceLink } from "@/lib/types"

type ResourceLinksProps = {
  links: ResourceLink[] | undefined
  className?: string
  compact?: boolean
}

export function ResourceLinks({ links, className, compact }: ResourceLinksProps) {
  if (!links?.length) return null

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {links.map((link, i) => {
        const isHttp = /^https?:\/\//i.test(link.href)
        return (
        <a
          key={`${link.href}-${i}`}
          href={link.href}
          {...(isHttp
            ? { target: "_blank" as const, rel: "noopener noreferrer" }
            : {})}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium text-primary hover:bg-muted transition-colors",
            compact && "text-[11px] px-1.5"
          )}
        >
          <LinkSimple size={compact ? 12 : 14} className="opacity-70 shrink-0" />
          <span className="truncate max-w-[140px]">{link.label}</span>
        </a>
      )})}
    </div>
  )
}
