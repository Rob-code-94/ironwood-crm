"use client"

import { ReactNode } from "react"

interface ResponsiveGridProps {
  children: ReactNode
  columns?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
  gap?: number
  className?: string
}

export function ResponsiveGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 4,
  className = "",
}: ResponsiveGridProps) {
  const gridColsMobile = columns.mobile ? `grid-cols-${columns.mobile}` : "grid-cols-1"
  const gridColsTablet = columns.tablet ? `md:grid-cols-${columns.tablet}` : "md:grid-cols-2"
  const gridColsDesktop = columns.desktop ? `lg:grid-cols-${columns.desktop}` : "lg:grid-cols-3"
  const gapClass = `gap-${gap}`

  return (
    <div className={`grid ${gridColsMobile} ${gridColsTablet} ${gridColsDesktop} ${gapClass} ${className}`}>
      {children}
    </div>
  )
}
