"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress, ProgressIndicator, ProgressTrack, ProgressValue } from "@/components/ui/progress"
import { ArrowClockwise, ArrowSquareOut, Download, Desktop } from "@phosphor-icons/react"
import { toast } from "sonner"
import { getElectron } from "@/lib/electron/client"
import type { IronwoodUpdateStatus } from "@/types/electron"

export function DesktopUpdateCard() {
  // Read the bridge once on mount so we don't trigger a synchronous setState
  // inside an effect (lint: react-hooks/set-state-in-effect).
  const [available] = useState(() => getElectron() != null)
  const [version, setVersion] = useState<string | null>(null)
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<IronwoodUpdateStatus>({ state: "idle" })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const bridge = getElectron()
    if (!bridge) return
    void bridge.appVersion().then(setVersion)
    void bridge.update.status().then((s) => {
      setStatus(s)
      if ((s.state === "available" || s.state === "downloaded") && s.version) {
        setAvailableVersion(s.version)
      }
    })
    return bridge.update.onStatus((s) => {
      setStatus(s)
      if ((s.state === "available" || s.state === "downloaded") && s.version) {
        setAvailableVersion(s.version)
      }
    })
  }, [])

  const onCheck = useCallback(async () => {
    const bridge = getElectron()
    if (!bridge) return
    setBusy(true)
    const res = await bridge.update.check()
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error ?? "Update check failed")
    } else if (res.version) {
      setAvailableVersion(res.version)
      toast.message(`Latest version: ${res.version}`)
    }
  }, [])

  const onInstall = useCallback(async () => {
    const bridge = getElectron()
    if (!bridge) return
    const res = await bridge.update.install()
    if (!res.ok) {
      const msg = res.error ?? "Install failed"
      toast.error(msg)
      if (/signature|code requirement/i.test(msg)) {
        toast.message(
          "macOS blocked replacing the app because the update is not signed the same way as your installed copy. Download the latest DMG from GitHub and drag it into Applications.",
          { duration: 12_000 }
        )
      }
    }
  }, [])

  const onOpenReleases = useCallback(async () => {
    const bridge = getElectron()
    if (!bridge) return
    const res = await bridge.update.openLatestRelease()
    if (!res.ok) toast.error(res.error ?? "Could not open releases page")
  }, [])

  if (!available) return null

  const isMac = getElectron()?.platform === "darwin"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Desktop size={18} />
          Desktop app
        </CardTitle>
        <CardDescription>
          {version ? `Installed version ${version}.` : "Detecting version…"}{" "}
          {availableVersion ? `Available version ${availableVersion}.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <UpdateStatusLine status={status} />
        {status.state === "downloading" ? (
          <Progress value={Number.isFinite(status.percent) ? status.percent : 0}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Downloading {availableVersion ?? "update"}{" "}
                {renderTransfer(status.transferred, status.total)}
              </span>
              <ProgressValue />
            </div>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCheck}
            disabled={busy || status.state === "checking" || status.state === "downloading"}
          >
            <ArrowClockwise size={14} />
            {busy || status.state === "checking" ? "Checking…" : "Check for updates"}
          </Button>
          {status.state === "downloaded" ? (
            <Button type="button" size="sm" onClick={onInstall}>
              <Download size={14} />
              Restart to install {status.version ?? "update"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onOpenReleases}>
            <ArrowSquareOut size={14} />
            Get latest DMG
          </Button>
        </div>
        {isMac ? (
          <p className="text-xs text-muted-foreground">
            In-app restart only works when every release is built with the same{" "}
            <strong className="font-medium text-foreground">Apple Developer ID</strong> signature.
            Unsigned CI builds can still download an update, but macOS may refuse to install it—use{" "}
            <strong className="font-medium text-foreground">Get latest DMG</strong> instead.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Ironwood checks for updates automatically a few seconds after launch and any time you
          press the button above. You can keep working while a download finishes in the background.
          Installation replaces the old app when you choose restart.
        </p>
      </CardContent>
    </Card>
  )
}

function renderTransfer(transferred?: number, total?: number): string {
  if (
    typeof transferred !== "number" ||
    typeof total !== "number" ||
    !Number.isFinite(transferred) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return ""
  }
  return `(${formatBytes(transferred)} / ${formatBytes(total)})`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function UpdateStatusLine({ status }: { status: IronwoodUpdateStatus }) {
  switch (status.state) {
    case "idle":
      return null
    case "checking":
      return <StatusRow icon={<ArrowClockwise size={14} />}>Checking for updates…</StatusRow>
    case "available":
      return (
        <StatusRow icon={<Download size={14} />}>
          Update {status.version ?? ""} available — downloading in the background.
        </StatusRow>
      )
    case "downloading": {
      const pct = Number.isFinite(status.percent) ? status.percent : 0
      return (
        <StatusRow icon={<Download size={14} />}>Downloading update… {pct}%</StatusRow>
      )
    }
    case "downloaded":
      return (
        <StatusRow icon={<Download size={14} />}>
          Update {status.version ?? ""} downloaded. Restart to apply.
        </StatusRow>
      )
    case "up-to-date":
      return (
        <StatusRow icon={<Cloud size={14} />}>
          Ironwood is up to date{status.version ? ` (${status.version})` : ""}.
        </StatusRow>
      )
    case "error":
      return (
        <StatusRow icon={<Cloud size={14} />}>
          <span className="text-destructive-foreground">Update check failed: {status.message}</span>
        </StatusRow>
      )
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function StatusRow({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span>{children}</span>
    </div>
  )
}
