// Bridge from renderer reminders to Electron's native Notification.
// Returns a thin reference so callers can clean up later if needed.

const { ipcMain, Notification, BrowserWindow, app } = require("electron")
const log = require("electron-log")

function setupNotifications({ getMainWindow }) {
  if (!Notification.isSupported()) {
    log.warn("[notifications] OS does not support Electron Notification API")
  }

  ipcMain.handle(
    "ironwood:notification-show",
    (_event, payload) => {
      try {
        const { title, body, tag, url, silent } = payload ?? {}
        if (!title) return { ok: false, error: "title required" }
        const notification = new Notification({
          title: String(title),
          body: body ? String(body) : undefined,
          silent: Boolean(silent),
        })
        notification.on("click", () => {
          const main = getMainWindow()
          if (main) {
            if (main.isMinimized()) main.restore()
            main.show()
            main.focus()
            if (typeof url === "string" && url.length > 0) {
              main.webContents.send("ironwood:navigate", url)
            }
          }
        })
        notification.show()
        return { ok: true, tag: tag ?? null }
      } catch (err) {
        log.warn(`[notifications] show failed: ${err}`)
        return { ok: false, error: String(err?.message ?? err) }
      }
    }
  )

  // macOS: clear Dock badge when a window is focused.
  app.on("browser-window-focus", () => {
    if (process.platform === "darwin" && typeof app.setBadgeCount === "function") {
      app.setBadgeCount(0)
    }
  })

  ipcMain.handle("ironwood:badge-set", (_event, count) => {
    if (typeof app.setBadgeCount === "function") {
      app.setBadgeCount(Math.max(0, Number(count) || 0))
      return { ok: true }
    }
    return { ok: false, error: "badge unsupported" }
  })

  return {
    dispose() {
      ipcMain.removeHandler("ironwood:notification-show")
      ipcMain.removeHandler("ironwood:badge-set")
    },
  }
}

module.exports = { setupNotifications }
