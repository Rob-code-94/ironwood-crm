// Electron main process for Ironwood Planner.
//
// - In packaged builds, spawns the bundled Next.js standalone server and points
//   the BrowserWindow at it so the app works without a separate Terminal.
// - In dev (`npm run electron:dev`), expects `next dev` on IRONWOOD_DEV_URL
//   (default http://127.0.0.1:3000).
// - Adds a tray with quick actions, an optional always-on-top mini calendar
//   window, OS notification bridge, and electron-updater integration with an
//   in-app "Check for updates" button.

const { app, BrowserWindow, clipboard, ipcMain, Menu, shell } = require("electron")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const log = require("electron-log")

const { startBundledServer, waitForHttp } = require("./server-bridge.cjs")
const { createMainWindow, createMiniWindow } = require("./windows.cjs")
const { createTray } = require("./tray.cjs")
const { setupAutoUpdater, checkForUpdatesManual } = require("./updater.cjs")
const { setupNotifications } = require("./notifications.cjs")

/** Matches `electron-builder.yml` publish target; used for “open releases” in Settings. */
const GITHUB_RELEASES_LATEST_URL = "https://github.com/Rob-code-94/ironwood-crm/releases/latest"

/** Always `…/Logs/Ironwood Planner/` (not the `package.json` name `ironwood-crm`). */
function getIronwoodLogsDirectory() {
  try {
    return path.join(app.getPath("logs"), "Ironwood Planner")
  } catch {
    if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Logs", "Ironwood Planner")
    }
    return path.join(os.homedir(), "Ironwood Planner", "logs")
  }
}

function getIronwoodLogFilePath() {
  return path.join(getIronwoodLogsDirectory(), "main.log")
}

function openIronwoodLogsFolder() {
  const dir = getIronwoodLogsDirectory()
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }
  void shell.openPath(dir).then((failed) => {
    if (failed) log.warn(`[main] open logs folder: ${failed}`)
  })
}

log.transports.file.level = "info"
log.transports.file.resolvePathFn = () => {
  const dir = getIronwoodLogsDirectory()
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    /* file transport may still work */
  }
  return getIronwoodLogFilePath()
}

function logStartupBanner() {
  log.info("══════════════════════════════════════════════════════════")
  log.info("[ironwood] Diagnostic log — attach this file when reporting issues.")
  log.info(`[ironwood] Log file: ${getIronwoodLogFilePath()}`)
  try {
    log.info(`[ironwood] userData: ${app.getPath("userData")}`)
  } catch (e) {
    log.info(`[ironwood] userData: (unavailable yet) ${e}`)
  }
  if (app.isPackaged) {
    log.info(`[ironwood] resourcesPath: ${process.resourcesPath}`)
  }
  log.info(
    `[ironwood] Ironwood Planner ${app.getVersion()} | ${process.platform} ${process.arch} | packaged=${app.isPackaged}`
  )
  log.info("══════════════════════════════════════════════════════════")
}

logStartupBanner()
log.info(`[main] starting Ironwood Planner ${app.getVersion()} (packaged=${app.isPackaged})`)

const DEV_URL = process.env.IRONWOOD_DEV_URL ?? "http://127.0.0.1:3000"

// Single-instance lock: prevents two icons spawning two servers.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

let mainWindow = null
let miniWindow = null
let trayHandle = null
let serverHandle = null
// When false (default): red close button closes the window like a normal app; the
// process stays running with Dock + menu-bar tray so you can reopen from either.
// Enable "Run in background" in the tray menu to hide-on-close instead of destroy.
let backgroundMode = false
let isQuitting = false

function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

function focusMain() {
  const win = getMainWindow()
  if (!win) {
    if (serverHandle) buildMainWindow(serverHandle.url)
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  try {
    win.moveTop()
  } catch {
    /* ignore */
  }
}

function buildMainWindow(baseUrl) {
  mainWindow = createMainWindow({ baseUrl, route: "/" })
  if (process.platform === "darwin" && app.dock) {
    app.dock.show()
  }
  // Ensure the window actually takes focus when launched from Finder / Dock.
  setImmediate(() => {
    const w = mainWindow
    if (!w || w.isDestroyed()) return
    try {
      w.show()
      w.focus()
      w.moveTop()
    } catch (err) {
      log.warn(`[main] focus main window failed: ${err}`)
    }
  })
  mainWindow.on("close", (event) => {
    if (backgroundMode && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on("closed", () => {
    mainWindow = null
  })
  return mainWindow
}

function ensureMiniWindow(baseUrl) {
  if (!baseUrl) {
    log.warn("[mini] ensureMiniWindow: no base URL (server not ready?)")
    return null
  }
  try {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.show()
      miniWindow.focus()
      return miniWindow
    }
    miniWindow = createMiniWindow({ baseUrl, route: "/calendar?embed=1" })
    miniWindow.on("closed", () => {
      miniWindow = null
    })
    return miniWindow
  } catch (err) {
    log.error(`[mini] ensureMiniWindow failed: ${err}`)
    return null
  }
}

/** File menu / shortcuts — only valid once the bundled server URL exists (packaged). */
function openMiniCalendarFromMenu() {
  try {
    const url = serverHandle?.url ?? (!app.isPackaged ? DEV_URL : null)
    if (!url) {
      log.warn("[menu] Mini Calendar: server URL not ready yet")
      return
    }
    ensureMiniWindow(url)
  } catch (err) {
    log.error(`[menu] Mini Calendar: ${err}`)
  }
}

function navigateMain(route) {
  const win = getMainWindow()
  if (!win) return
  const baseUrl = serverHandle?.url ?? DEV_URL
  void win.loadURL(baseUrl.replace(/\/$/, "") + (route.startsWith("/") ? route : `/${route}`))
  focusMain()
}

async function bootstrap() {
  app.setName("Ironwood Planner")

  let baseUrl = DEV_URL
  if (app.isPackaged) {
    try {
      serverHandle = await startBundledServer({
        resourcesPath: process.resourcesPath,
        userDataPath: app.getPath("userData"),
      })
      baseUrl = serverHandle.url
    } catch (err) {
      log.error(`[main] bundled server failed: ${err}`)
      app.quit()
      return
    }
  } else {
    log.info(`[main] dev mode; waiting for ${DEV_URL}`)
    try {
      await waitForHttp(DEV_URL, { timeoutMs: 60_000 })
      serverHandle = { url: DEV_URL, port: Number(new URL(DEV_URL).port || 80), stop: () => {} }
    } catch (err) {
      log.error(`[main] dev server not reachable: ${err}`)
      app.quit()
      return
    }
  }

  buildMainWindow(baseUrl)

  const notifications = setupNotifications({ getMainWindow })
  setupAutoUpdater()

  trayHandle = createTray({
    onShowMain: focusMain,
    onOpenCalendar: () => ensureMiniWindow(serverHandle?.url ?? DEV_URL),
    onOpenSettings: () => navigateMain("/settings"),
    onCheckUpdates: () => checkForUpdatesManual(),
    onQuit: () => {
      isQuitting = true
      app.quit()
    },
    getBackgroundMode: () => backgroundMode,
    setBackgroundMode: (value) => {
      backgroundMode = value
    },
  })

  ipcMain.handle("ironwood:app-version", () => app.getVersion())
  ipcMain.handle("ironwood:window-mini", () => {
    const url = serverHandle?.url ?? (!app.isPackaged ? DEV_URL : null)
    if (!url) return { ok: false, error: "server not ready" }
    ensureMiniWindow(url)
    return { ok: true }
  })
  ipcMain.handle("ironwood:app-quit", () => {
    isQuitting = true
    app.quit()
    return { ok: true }
  })
  ipcMain.handle("ironwood:debug-paths", () => ({
    logFile: getIronwoodLogFilePath(),
    logsDir: getIronwoodLogsDirectory(),
    userData: app.getPath("userData"),
    resourcesPath: app.isPackaged ? process.resourcesPath : null,
    version: app.getVersion(),
  }))
  ipcMain.handle("ironwood:open-logs-folder", () => {
    openIronwoodLogsFolder()
    return { ok: true }
  })
  ipcMain.handle("ironwood:open-user-data-folder", () => {
    const dir = app.getPath("userData")
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch {
      /* ignore */
    }
    void shell.openPath(dir).then((failed) => {
      if (failed) log.warn(`[main] open userData folder: ${failed}`)
    })
    return { ok: true }
  })
  ipcMain.handle("ironwood:open-latest-release", async () => {
    try {
      await shell.openExternal(GITHUB_RELEASES_LATEST_URL)
      return { ok: true }
    } catch (e) {
      log.warn(`[main] open latest release: ${e}`)
      return { ok: false, error: String(e?.message ?? e) }
    }
  })

  app.on("before-quit", () => {
    isQuitting = true
    notifications.dispose()
    trayHandle?.destroy()
    if (serverHandle) {
      try {
        serverHandle.stop()
      } catch (err) {
        log.warn(`[main] server stop failed: ${err}`)
      }
      serverHandle = null
    }
  })

  Menu.setApplicationMenu(buildAppMenu())
}

app.on("second-instance", () => {
  focusMain()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (serverHandle) buildMainWindow(serverHandle.url)
  } else {
    focusMain()
  }
})

app.on("window-all-closed", () => {
  // On macOS we typically stay alive (tray + reopen via Dock). On Windows/Linux,
  // honor the user's background-mode preference; otherwise quit.
  if (process.platform !== "darwin" && !backgroundMode) {
    app.quit()
  }
})

// Reduce console noise + harden defaults.
app.setAppUserModelId("com.ironwood.planner")

function buildAppMenu() {
  const isMac = process.platform === "darwin"
  return Menu.buildFromTemplate([
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Check for Updates…",
                click: () => void checkForUpdatesManual(),
              },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Mini Calendar",
          accelerator: "CmdOrCtrl+Alt+M",
          click: () => openMiniCalendarFromMenu(),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        ...(isMac
          ? []
          : [
              {
                label: "Check for Updates…",
                click: () => void checkForUpdatesManual(),
              },
              { type: "separator" },
            ]),
        {
          label: "Open logs folder…",
          click: () => openIronwoodLogsFolder(),
        },
        {
          label: "Copy log file path",
          click: () => {
            clipboard.writeText(getIronwoodLogFilePath())
          },
        },
        {
          label: "Open workspace sync folder…",
          click: () => {
            const dir = app.getPath("userData")
            try {
              fs.mkdirSync(dir, { recursive: true })
            } catch {
              /* ignore */
            }
            void shell.openPath(dir).then((failed) => {
              if (failed) log.warn(`[help] open userData: ${failed}`)
            })
          },
        },
        { type: "separator" },
        {
          label: "Open Project Site",
          click: () => shell.openExternal("https://github.com/Rob-code-94/ironwood-crm"),
        },
      ],
    },
  ])
}

app.whenReady().then(bootstrap).catch((err) => {
  log.error(`[main] bootstrap failed: ${err}`)
  app.quit()
})
