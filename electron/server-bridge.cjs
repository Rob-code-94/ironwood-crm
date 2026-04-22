// Spawns the bundled Next.js standalone server in production builds and waits
// for it to start accepting connections so the BrowserWindow has somewhere to load.

const { spawn } = require("node:child_process")
const http = require("node:http")
const net = require("node:net")
const path = require("node:path")
const fs = require("node:fs")

const log = require("electron-log")

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address()
      const port = typeof addr === "object" && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

/**
 * Optional Firebase / workspace env for the bundled Next server (same source of truth as the hosted app).
 * Place `server-env.json` next to other app data — see Electron `userData` path (Help → Open workspace sync folder).
 * Keys are merged into the child process env; keys starting with "_" are ignored (documentation only).
 */
function loadOptionalServerEnv(userDataPath) {
  if (!userDataPath || typeof userDataPath !== "string") return {}
  const jsonPath = path.join(userDataPath, "server-env.json")
  try {
    if (!fs.existsSync(jsonPath)) return {}
    const raw = fs.readFileSync(jsonPath, "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    /** @type {Record<string, string>} */
    const out = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (k.startsWith("_")) continue
      if (typeof v !== "string" || !v.trim()) continue
      out[k] = v
    }
    return out
  } catch (e) {
    log.warn(`[server] could not read server-env.json: ${(e && e.message) || e}`)
    return {}
  }
}

function computeDesktopWorkspaceEnv(userDataPath) {
  if (!userDataPath || typeof userDataPath !== "string") return {}
  const workspaceFile = path.join(userDataPath, "workspace-snapshot.json")
  return {
    // Desktop packaged app runs in production, but we still want local workspace
    // snapshot sync enabled even when Firebase admin credentials are missing.
    IRONWOOD_WORKSPACE_ALLOW_PRODUCTION: "true",
    IRONWOOD_WORKSPACE_FILE: workspaceFile,
  }
}

function waitForHttp(url, { timeoutMs = 30000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.request(url, { method: "GET" }, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) {
          resolve()
        } else if (Date.now() > deadline) {
          reject(new Error(`Server returned ${res.statusCode} for ${url}`))
        } else {
          setTimeout(tick, intervalMs)
        }
      })
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`))
        } else {
          setTimeout(tick, intervalMs)
        }
      })
      req.end()
    }
    tick()
  })
}

/**
 * Locate the bundled Next standalone server.js inside the packaged app.
 *
 * Layout assembled by scripts/copy-electron-bundle.mjs and shipped via
 * electron-builder `extraResources` (nested `app/` so `node_modules` is not
 * stripped — see copy script).
 *   <resourcesPath>/server/app/server.js
 *   <resourcesPath>/server/app/.next/static/...
 *   <resourcesPath>/server/app/public/...
 */
function resolveBundledServer(resourcesPath) {
  const root = path.join(resourcesPath, "server", "app")
  const serverJs = path.join(root, "server.js")
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Bundled server.js not found at ${serverJs}. Did the build copy .next/standalone?`
    )
  }
  return { root, serverJs }
}

async function startBundledServer({ resourcesPath, hostname = "127.0.0.1", userDataPath }) {
  const { root, serverJs } = resolveBundledServer(resourcesPath)
  const nextPkg = path.join(root, "node_modules", "next", "package.json")
  log.info(`[server] bundle root (cwd): ${root}`)
  log.info(`[server] server.js: ${serverJs}`)
  log.info(`[server] node_modules/next present: ${fs.existsSync(nextPkg)}`)
  const port = await findFreePort()
  const url = `http://${hostname}:${port}`

  const extraEnv = loadOptionalServerEnv(userDataPath)
  const desktopWorkspaceEnv = computeDesktopWorkspaceEnv(userDataPath)
  if (Object.keys(extraEnv).length > 0) {
    const pid = extraEnv.FIREBASE_PROJECT_ID
    log.info(
      `[server] loaded server-env.json (${Object.keys(extraEnv).length} var(s)` +
        (pid ? `, Firebase project: ${pid}` : "") +
        ")"
    )
  } else if (userDataPath) {
    log.info(
      "[server] no server-env.json in userData — /api/workspace/snapshot may be unavailable; " +
        "projects stay empty until you add Firebase credentials (same as hosted app) or use local-only data."
    )
  }
  if (desktopWorkspaceEnv.IRONWOOD_WORKSPACE_FILE) {
    log.info(
      `[server] workspace fallback file: ${desktopWorkspaceEnv.IRONWOOD_WORKSPACE_FILE}`
    )
  }

  log.info(`[server] starting bundled Next server: node ${serverJs} (cwd=${root})`)

  const child = spawn(process.execPath, [serverJs], {
    cwd: root,
    env: {
      ...process.env,
      ...desktopWorkspaceEnv,
      ...extraEnv,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: hostname,
      // Run the embedded Node from Electron with no Chromium APIs exposed.
      ELECTRON_RUN_AS_NODE: "1",
      // Avoid Next inheriting the Electron app's NODE_OPTIONS (e.g. inspector).
      NODE_OPTIONS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout?.on("data", (chunk) => {
    log.info(`[next] ${chunk.toString().trimEnd()}`)
  })
  child.stderr?.on("data", (chunk) => {
    log.warn(`[next:err] ${chunk.toString().trimEnd()}`)
  })
  child.on("exit", (code, signal) => {
    log.warn(`[next] server exited (code=${code} signal=${signal})`)
  })

  await waitForHttp(url)
  log.info(`[server] ready at ${url}`)

  return {
    url,
    port,
    stop: () => {
      if (!child.killed) {
        try {
          child.kill("SIGTERM")
        } catch (err) {
          log.warn(`[server] kill failed: ${err}`)
        }
      }
    },
  }
}

module.exports = {
  startBundledServer,
  waitForHttp,
}
