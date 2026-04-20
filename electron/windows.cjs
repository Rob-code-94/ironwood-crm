// Window factories shared by main, tray, and IPC handlers.

const path = require("node:path")
const { BrowserWindow, shell } = require("electron")
const log = require("electron-log")

const PRELOAD = path.join(__dirname, "preload.cjs")
const ICON = path.join(__dirname, "assets", "icon.png")

function commonWebPreferences() {
  return {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    // Next.js + React in a localhost BrowserWindow is more reliable without the
    // renderer sandbox (still no nodeIntegration; preload is the bridge).
    sandbox: false,
    spellcheck: true,
  }
}

function attachExternalLinkHandler(win) {
  // Open http(s) links in the user's default browser instead of new Electron windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url).catch(() => undefined)
      return { action: "deny" }
    }
    return { action: "allow" }
  })
  win.webContents.on("will-navigate", (event, url) => {
    try {
      const currentUrl = win.webContents.getURL()
      // First paint loads from `about:blank` → app origin; comparing origins to
      // `about:blank` would wrongly treat localhost as "external" and cancel the
      // navigation, leaving a hidden window that never reaches ready-to-show.
      if (!currentUrl || currentUrl === "about:blank" || currentUrl.startsWith("about:")) {
        return
      }
      const target = new URL(url)
      const current = new URL(currentUrl)
      if (target.origin !== current.origin) {
        event.preventDefault()
        shell.openExternal(url).catch(() => undefined)
      }
    } catch {
      /* ignore unparseable */
    }
  })
}

/** Show the window as soon as any load milestone fires; log failures (common Electron foot-gun). */
function wireWindowShowPipeline(win, label) {
  // Always call show() — on macOS `isVisible()` can be wrong during early load,
  // which previously left `show: false` windows invisible forever.
  const forceShow = () => {
    if (!win.isDestroyed()) {
      try {
        win.show()
      } catch (e) {
        log.warn(`[windows:${label}] show() failed: ${e}`)
      }
    }
  }
  win.once("ready-to-show", forceShow)
  win.webContents.once("dom-ready", forceShow)
  win.webContents.once("did-finish-load", forceShow)
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame === false) return
    log.error(
      `[windows:${label}] did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`
    )
    forceShow()
  })
  const fallbackShow = setTimeout(() => {
    if (!win.isDestroyed()) {
      log.warn(`[windows:${label}] backup show after 8s`)
      forceShow()
    }
  }, 8000)
  win.once("closed", () => clearTimeout(fallbackShow))
}

function createMainWindow({ baseUrl, route = "/" }) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0f172a",
    title: "Ironwood Planner",
    icon: ICON,
    // Standard title bar + traffic lights (normal window alongside the menu-bar tray).
    titleBarStyle: "default",
    // Show the shell immediately so macOS always has a real window to present;
    // content still loads asynchronously.
    show: true,
    webPreferences: commonWebPreferences(),
  })
  win.center()

  attachExternalLinkHandler(win)
  wireWindowShowPipeline(win, "main")
  const startUrl = joinUrl(baseUrl, route)
  log.info(`[windows:main] loading ${startUrl}`)
  void win
    .loadURL(startUrl)
    .catch((err) => {
      log.error(`[windows:main] loadURL rejected: ${err}`)
      if (!win.isDestroyed()) win.show()
    })
  return win
}

function createMiniWindow({ baseUrl, route = "/calendar?embed=1" }) {
  const win = new BrowserWindow({
    width: 420,
    height: 560,
    minWidth: 320,
    minHeight: 360,
    backgroundColor: "#0f172a",
    title: "Ironwood Mini",
    icon: ICON,
    alwaysOnTop: true,
    frame: true,
    show: true,
    skipTaskbar: false,
    webPreferences: commonWebPreferences(),
  })
  win.center()
  attachExternalLinkHandler(win)
  wireWindowShowPipeline(win, "mini")
  const miniUrl = joinUrl(baseUrl, route)
  log.info(`[windows:mini] loading ${miniUrl}`)
  void win.loadURL(miniUrl).catch((err) => {
    log.error(`[windows:mini] loadURL rejected: ${err}`)
    if (!win.isDestroyed()) win.show()
  })
  return win
}

function createPopoverWindow({ baseUrl, route = "/?embed=1" }) {
  const win = new BrowserWindow({
    width: 360,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#0f172a",
    icon: ICON,
    webPreferences: commonWebPreferences(),
  })
  attachExternalLinkHandler(win)
  void win.loadURL(joinUrl(baseUrl, route))
  return win
}

function joinUrl(base, route) {
  if (!route) return base
  if (route.startsWith("http://") || route.startsWith("https://")) return route
  if (route.startsWith("/")) return `${base.replace(/\/$/, "")}${route}`
  return `${base.replace(/\/$/, "")}/${route}`
}

module.exports = {
  createMainWindow,
  createMiniWindow,
  createPopoverWindow,
  joinUrl,
}
