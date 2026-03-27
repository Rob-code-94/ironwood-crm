"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

type ActiveClientContextValue = {
  activeClientId: string | null
  setActiveClientId: (id: string | null) => void
}

const ActiveClientContext = createContext<ActiveClientContextValue | null>(null)

export function ActiveClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const value = useMemo(
    () => ({ activeClientId, setActiveClientId }),
    [activeClientId]
  )
  return (
    <ActiveClientContext.Provider value={value}>
      {children}
    </ActiveClientContext.Provider>
  )
}

export function useActiveClientId() {
  const ctx = useContext(ActiveClientContext)
  if (!ctx) throw new Error("useActiveClientId must be used within ActiveClientProvider")
  return ctx.activeClientId
}

export function useSetActiveClientId() {
  const ctx = useContext(ActiveClientContext)
  if (!ctx) throw new Error("useSetActiveClientId must be used within ActiveClientProvider")
  return ctx.setActiveClientId
}
