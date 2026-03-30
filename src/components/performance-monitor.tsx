"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Cpu, Zap } from "lucide-react"

type MemoryInfo = {
  usedJSHeapSize: number
  jsHeapSizeLimit: number
}

type PerformanceWithMemory = Performance & {
  memory?: MemoryInfo
}

interface PerformanceMetrics {
  fcp: number
  lcp: number
  cls: number
  fid: number
  memory?: number
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Measure Core Web Vitals
    const onMetric = (metric: { name: string; value: number }) => {
      const key = metric.name.toLowerCase() as keyof PerformanceMetrics
      setMetrics((prev) => {
        const base: PerformanceMetrics = prev ?? {
          fcp: 0,
          lcp: 0,
          cls: 0,
          fid: 0,
        }
        return { ...base, [key]: metric.value }
      })
    }

    // Use web-vitals or native APIs
    if ("PerformanceObserver" in window) {
      try {
        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number
            loadTime?: number
          }
          onMetric({
            name: "LCP",
            value: lastEntry.renderTime ?? lastEntry.loadTime ?? 0,
          })
        })
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] })

        // Cumulative Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
          let cls = 0
          for (const entry of list.getEntries()) {
            const ls = entry as PerformanceEntry & {
              hadRecentInput?: boolean
              value: number
            }
            if (!ls.hadRecentInput) {
              cls += ls.value
            }
          }
          onMetric({ name: "CLS", value: cls })
        })
        clsObserver.observe({ entryTypes: ["layout-shift"] })

        return () => {
          lcpObserver.disconnect()
          clsObserver.disconnect()
        }
      } catch (e) {
        console.error("Performance monitoring error:", e)
      }
    }

    const perf = performance as PerformanceWithMemory
    if (perf.memory) {
      const memPercent =
        ((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100) | 0
      onMetric({ name: "Memory", value: memPercent })
    }
  }, [])

  const getStatus = (metric: string, value: number) => {
    if (metric === "memory") {
      return value < 50 ? "good" : value < 80 ? "warning" : "poor"
    }
    if (metric === "lcp") return value < 2500 ? "good" : value < 4000 ? "warning" : "poor"
    if (metric === "cls") return value < 0.1 ? "good" : value < 0.25 ? "warning" : "poor"
    return "good"
  }

  const statusColor = {
    good: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    poor: "text-red-600 dark:text-red-400",
  }

  if (!metrics) return null

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap size={16} />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.lcp && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Activity size={14} />
              LCP
            </span>
            <span className={`font-semibold ${statusColor[getStatus("lcp", metrics.lcp)]}`}>
              {metrics.lcp.toFixed(0)}ms
            </span>
          </div>
        )}
        {metrics.cls !== undefined && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Activity size={14} />
              CLS
            </span>
            <span className={`font-semibold ${statusColor[getStatus("cls", metrics.cls)]}`}>
              {metrics.cls.toFixed(2)}
            </span>
          </div>
        )}
        {metrics.memory !== undefined && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Cpu size={14} />
              Memory
            </span>
            <span className={`font-semibold ${statusColor[getStatus("memory", metrics.memory)]}`}>
              {metrics.memory.toFixed(0)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
