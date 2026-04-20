// Renderer <-> main bridge. Exposes a single `window.ironwood` object whose
// shape is mirrored in `src/types/electron.d.ts` for type safety.

const { contextBridge, ipcRenderer } = require("electron")

const updateListeners = new Set()
ipcRenderer.on("ironwood:update-status", (_event, status) => {
  for (const listener of updateListeners) {
    try {
      listener(status)
    } catch {
      /* swallow listener errors so one bad listener doesn't break others */
    }
  }
})

const navigateListeners = new Set()
ipcRenderer.on("ironwood:navigate", (_event, url) => {
  for (const listener of navigateListeners) {
    try {
      listener(url)
    } catch {
      /* see above */
    }
  }
})

contextBridge.exposeInMainWorld("ironwood", {
  isElectron: true,
  platform: process.platform,
  appVersion: () => ipcRenderer.invoke("ironwood:app-version"),

  update: {
    check: () => ipcRenderer.invoke("ironwood:update-check"),
    status: () => ipcRenderer.invoke("ironwood:update-status"),
    install: () => ipcRenderer.invoke("ironwood:update-install"),
    openLatestRelease: () => ipcRenderer.invoke("ironwood:open-latest-release"),
    onStatus: (listener) => {
      updateListeners.add(listener)
      return () => updateListeners.delete(listener)
    },
  },

  notifications: {
    show: (payload) => ipcRenderer.invoke("ironwood:notification-show", payload),
    setBadge: (count) => ipcRenderer.invoke("ironwood:badge-set", count),
  },

  windows: {
    openMiniCalendar: () => ipcRenderer.invoke("ironwood:window-mini"),
    quit: () => ipcRenderer.invoke("ironwood:app-quit"),
  },

  debug: {
    paths: () => ipcRenderer.invoke("ironwood:debug-paths"),
    openLogsFolder: () => ipcRenderer.invoke("ironwood:open-logs-folder"),
    openUserDataFolder: () => ipcRenderer.invoke("ironwood:open-user-data-folder"),
  },

  navigation: {
    onNavigate: (listener) => {
      navigateListeners.add(listener)
      return () => navigateListeners.delete(listener)
    },
  },
})
