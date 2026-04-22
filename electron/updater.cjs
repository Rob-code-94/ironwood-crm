// Wrapper around electron-updater that exposes a small, IPC-friendly API.
//
// Status events are forwarded to all renderer windows on `ironwood:update-status`
// so the Settings UI can show progress + a final "Restart to install" prompt.

const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const log = require("electron-log")

let updater
try {
  updater = require("electron-updater").autoUpdater
  updater.logger = log
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  // GitHub no longer serves JSON for `…/releases/latest` with `Accept: application/json`
  // (GitHubProvider gets 406). Using the Atom feed avoids that request while still
  // resolving `latest-mac.yml` under each tag’s release assets.
  updater.allowPrerelease = true
} catch (err) {
  log.warn(`[updater] electron-updater not available: ${err}`)
}

let lastStatus = { state: "idle" }

function isSignatureInstallError(input) {
  const msg = String(input?.message ?? input ?? "").toLowerCase()
  return (
    msg.includes("code signature") ||
    msg.includes("code requirement") ||
    msg.includes("did not pass validation")
  )
}

function toUserUpdateError(err) {
  if (isSignatureInstallError(err)) {
    return "macOS blocked in-app install for this unsigned build. Use 'Get latest DMG', replace the app in Applications, then reopen."
  }
  return String(err?.message ?? err)
}

function broadcast(status) {
  lastStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("ironwood:update-status", status)
    }
  }
}

function setupAutoUpdater() {
  if (!updater) {
    log.info("[updater] disabled (running outside packaged build)")
    return null
  }
  if (!app.isPackaged) {
    log.info("[updater] not packaged; skipping auto check")
    return updater
  }

  updater.on("checking-for-update", () => broadcast({ state: "checking" }))
  updater.on("update-available", (info) =>
    broadcast({ state: "available", version: info?.version })
  )
  updater.on("update-not-available", (info) =>
    broadcast({ state: "up-to-date", version: info?.version })
  )
  updater.on("error", (err) => broadcast({ state: "error", message: toUserUpdateError(err) }))
  updater.on("download-progress", (progress) =>
    broadcast({
      state: "downloading",
      percent: Math.round(progress?.percent ?? 0),
      transferred: progress?.transferred,
      total: progress?.total,
    })
  )
  updater.on("update-downloaded", (info) =>
    broadcast({ state: "downloaded", version: info?.version })
  )

  ipcMain.handle("ironwood:update-check", async () => {
    try {
      const result = await updater.checkForUpdates()
      return { ok: true, version: result?.updateInfo?.version }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  })

  ipcMain.handle("ironwood:update-status", () => lastStatus)

  ipcMain.handle("ironwood:update-install", async () => {
    if (process.platform === "darwin") {
      return {
        ok: false,
        error:
          "In-app install is disabled for unsigned macOS builds. Use 'Get latest DMG', replace the app in Applications, then reopen.",
      }
    }
    try {
      // `isSilent: true` keeps install non-interactive; `isForceRunAfter: true`
      // relaunches the new version so the user lands back in the app.
      updater.quitAndInstall(true, true)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  })

  // Best-effort startup check, deferred so window paint isn't blocked.
  setTimeout(() => {
    updater.checkForUpdates().catch((err) => log.warn(`[updater] startup check failed: ${err}`))
  }, 5_000)

  return updater
}

/**
 * Menu / tray: check GitHub Releases (see electron-builder `publish`), download if newer,
 * then offer restart — same flow as the in-app Settings button.
 */
async function checkForUpdatesManual() {
  if (!updater || !app.isPackaged) {
    await dialog.showMessageBox({
      type: "info",
      title: "Ironwood Planner",
      message:
        "Automatic updates apply to the installed app (DMG/ZIP from a release). When running from source with npm run electron:dev, build a new installer with npm run electron:dist instead.",
      buttons: ["OK"],
    })
    return
  }

  const currentVersion = app.getVersion()

  try {
    const result = await updater.checkForUpdates()

    if (!result || !result.isUpdateAvailable) {
      await dialog.showMessageBox({
        type: "info",
        title: "Ironwood Planner",
        message: `You're on the latest version (${currentVersion}).`,
        buttons: ["OK"],
      })
      return
    }

    const nextVersion = result.updateInfo?.version ?? "newer"

    try {
      if (result.downloadPromise) {
        await result.downloadPromise
      } else {
        await new Promise((resolve, reject) => {
          const ms = 120_000
          const timer = setTimeout(() => {
            cleanup()
            reject(new Error("Timed out waiting for the update to download."))
          }, ms)
          const onDone = () => {
            clearTimeout(timer)
            cleanup()
            resolve()
          }
          const onErr = (e) => {
            clearTimeout(timer)
            cleanup()
            reject(e)
          }
          function cleanup() {
            updater.removeListener("update-downloaded", onDone)
            updater.removeListener("error", onErr)
          }
          updater.once("update-downloaded", onDone)
          updater.once("error", onErr)
        })
      }
    } catch (dlErr) {
      log.warn(`[updater] manual download failed: ${dlErr}`)
      await dialog.showMessageBox({
        type: "error",
        title: "Download failed",
        message: String(dlErr?.message ?? dlErr),
        buttons: ["OK"],
      })
      return
    }

    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Update ready",
      message:
        `Version ${nextVersion} is ready.\n\n` +
        "For unsigned macOS builds, install via DMG:\n" +
        "1) Open latest release\n2) Download DMG\n3) Drag app to Applications and replace\n4) Reopen Ironwood Planner.",
      buttons: ["Open latest release", "Later"],
      defaultId: 0,
      cancelId: 1,
    })

    if (response === 0) {
      try {
        await require("electron").shell.openExternal(
          "https://github.com/Rob-code-94/ironwood-crm/releases/latest"
        )
      } catch (openErr) {
        log.warn(`[updater] open release link: ${openErr}`)
      }
    }
  } catch (err) {
    log.warn(`[updater] manual check failed: ${err}`)
    await dialog.showMessageBox({
      type: "error",
      title: "Update check failed",
      message: String(err?.message ?? err),
      buttons: ["OK"],
    })
  }
}

module.exports = { setupAutoUpdater, checkForUpdatesManual }
