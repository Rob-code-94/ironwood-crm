// Renderer-side helpers for talking to the Electron main process.
// All callers must guard with `getElectron()` so the same code runs in browser
// (returns null) and in the desktop shell (returns the bridge).

import type { IronwoodBridge } from "@/types/electron"

export function getElectron(): IronwoodBridge | null {
  if (typeof window === "undefined") return null
  return window.ironwood ?? null
}

export function isElectron(): boolean {
  return getElectron() != null
}
