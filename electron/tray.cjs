// Status-bar / system-tray integration: icon, context menu, optional popover toggle.

const { Tray, Menu, nativeImage, screen } = require("electron")
const path = require("node:path")

// 18x18 monochrome PNG (transparent background, dark glyph) encoded inline so
// we don't need to ship a separate template asset file. macOS treats files
// ending in `Template.png` as automatically tinted; we mark it manually below.
const TRAY_ICON_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAYUlEQVQ4jWNgGAWjYBSMghECCgsLg4UMDAxMmJgYGBgYGBjwYx0MJiBgYGBgYWFhYGFhYWBgYGBg+E8CGNUyKkdGwSgYBSMNAACjcZHv9d+ZzAAAAABJRU5ErkJggg=="

function buildTrayImage() {
  const buf = Buffer.from(TRAY_ICON_BASE64, "base64")
  const img = nativeImage.createFromBuffer(buf)
  if (process.platform === "darwin") {
    img.setTemplateImage(true)
  }
  return img
}

function fallbackTrayImage() {
  return nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")).resize({
    width: 18,
    height: 18,
  })
}

/**
 * @param {Object} options
 * @param {() => void} options.onShowMain      Focus / restore the main window.
 * @param {() => void} options.onOpenCalendar  Open or focus the mini calendar window.
 * @param {() => void} options.onOpenSettings  Navigate the main window to settings.
 * @param {() => void} options.onCheckUpdates  Trigger an explicit update check.
 * @param {() => void} options.onQuit          Fully quit the app.
 * @param {() => boolean} options.getBackgroundMode  Whether closing windows keeps the app alive.
 * @param {(value: boolean) => void} options.setBackgroundMode
 */
function createTray(options) {
  let image
  try {
    image = buildTrayImage()
    if (image.isEmpty()) image = fallbackTrayImage()
  } catch {
    image = fallbackTrayImage()
  }
  const tray = new Tray(image)
  tray.setToolTip("Ironwood Planner")

  const refreshMenu = () => {
    const backgroundMode = options.getBackgroundMode()
    const menu = Menu.buildFromTemplate([
      {
        label: "Show main window",
        click: () => options.onShowMain(),
      },
      { label: "Mini calendar", click: () => options.onOpenCalendar() },
      { label: "Settings", click: () => options.onOpenSettings() },
      { type: "separator" },
      { label: "Check for updates", click: () => options.onCheckUpdates() },
      { type: "separator" },
      {
        label: "Hide window to menu bar only (don’t close app)",
        type: "checkbox",
        checked: backgroundMode,
        click: (item) => {
          options.setBackgroundMode(item.checked)
          refreshMenu()
        },
      },
      { type: "separator" },
      { label: "Quit Ironwood", click: () => options.onQuit() },
    ])
    tray.setContextMenu(menu)
  }

  refreshMenu()
  tray.on("click", () => options.onShowMain())

  return {
    tray,
    refresh: refreshMenu,
    destroy: () => {
      try {
        tray.destroy()
      } catch {
        /* tray may already be destroyed during quit */
      }
    },
    /** Reposition a popover window directly under the tray icon. */
    positionPopoverNearTray: (win) => {
      const bounds = tray.getBounds()
      const winBounds = win.getBounds()
      const display = screen.getDisplayMatching(bounds)
      const x = Math.round(bounds.x + bounds.width / 2 - winBounds.width / 2)
      const y =
        process.platform === "darwin"
          ? Math.round(bounds.y + bounds.height + 4)
          : Math.round(display.workArea.y + display.workArea.height - winBounds.height - 4)
      win.setBounds({ x, y, width: winBounds.width, height: winBounds.height })
    },
  }
}

module.exports = { createTray }
