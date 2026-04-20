// Mirror of the API exposed by electron/preload.cjs via contextBridge.
// Keep these shapes in sync if you add new IPC handlers.

export type IronwoodUpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version?: string }
  | { state: "downloading"; percent: number; transferred?: number; total?: number }
  | { state: "downloaded"; version?: string }
  | { state: "up-to-date"; version?: string }
  | { state: "error"; message: string }

export type IronwoodNotificationPayload = {
  title: string
  body?: string
  tag?: string
  url?: string
  silent?: boolean
}

export type IronwoodIpcResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<string, never> : T))
  | { ok: false; error: string }

export type IronwoodDebugPaths = {
  logFile: string
  logsDir: string
  userData: string
  resourcesPath: string | null
  version: string
}

export interface IronwoodBridge {
  isElectron: true
  platform: NodeJS.Platform
  appVersion: () => Promise<string>
  update: {
    check: () => Promise<{ ok: boolean; version?: string; error?: string }>
    status: () => Promise<IronwoodUpdateStatus>
    install: () => Promise<{ ok: boolean; error?: string }>
    /** Opens the GitHub Releases page (for manual DMG install when auto-install is blocked). */
    openLatestRelease: () => Promise<{ ok: boolean; error?: string }>
    onStatus: (listener: (status: IronwoodUpdateStatus) => void) => () => void
  }
  notifications: {
    show: (
      payload: IronwoodNotificationPayload
    ) => Promise<{ ok: boolean; tag?: string | null; error?: string }>
    setBadge: (count: number) => Promise<{ ok: boolean; error?: string }>
  }
  windows: {
    openMiniCalendar: () => Promise<{ ok: boolean }>
    quit: () => Promise<{ ok: boolean }>
  }
  debug: {
    paths: () => Promise<IronwoodDebugPaths>
    openLogsFolder: () => Promise<{ ok: true }>
    /** Opens Application Support folder where `server-env.json` lives (desktop sync with hosted Firestore). */
    openUserDataFolder: () => Promise<{ ok: true }>
  }
  navigation: {
    onNavigate: (listener: (url: string) => void) => () => void
  }
}

declare global {
  interface Window {
    ironwood?: IronwoodBridge
  }
}

export {}
