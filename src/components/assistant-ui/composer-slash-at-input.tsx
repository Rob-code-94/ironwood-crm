"use client"

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react"
import { ComposerPrimitive, useAui, useAuiState } from "@assistant-ui/react"
import { SLASH_COMMANDS } from "@/lib/assistant/commands"
import { useWorkspace } from "@/lib/workspace/context"
import { cn } from "@/lib/utils"

type Trigger =
  | { kind: "slash"; query: string; replaceFrom: number }
  | { kind: "mention"; query: string; replaceFrom: number }

function parseTrigger(text: string, cursor: number): Trigger | null {
  const lineStart = text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1
  const linePrefix = text.slice(lineStart, cursor)
  const slash = /\/([\w-]*)$/.exec(linePrefix)
  const at = /@([\w\s.-]*)$/.exec(linePrefix)
  let best: Trigger | null = null
  if (slash && slash.index !== undefined) {
    best = { kind: "slash", query: slash[1] ?? "", replaceFrom: lineStart + slash.index }
  }
  if (at && at.index !== undefined) {
    const from = lineStart + at.index
    if (!best || from > best.replaceFrom) {
      best = { kind: "mention", query: at[1] ?? "", replaceFrom: from }
    }
  }
  return best
}

type ComposerInputProps = ComponentProps<typeof ComposerPrimitive.Input>

export function ComposerSlashAtInput(props: ComposerInputProps) {
  const { onChange, onKeyDown, onSelect, className, ...rest } = props
  const aui = useAui()
  const { projects, contacts } = useWorkspace()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [trigger, setTrigger] = useState<Trigger | null>(null)
  const [highlightIdx, setHighlightIdx] = useState(0)

  const isEditing = useAuiState((s) => s.composer.isEditing)

  const mentionItems = useMemo(() => {
    const ps = projects.map((p) => ({ key: `p-${p.id}`, label: p.name }))
    const cs = contacts.map((c) => ({ key: `c-${c.id}`, label: c.name }))
    return [...ps, ...cs].sort((a, b) => a.label.localeCompare(b.label))
  }, [projects, contacts])

  const slashMatches = useMemo(() => {
    if (!trigger || trigger.kind !== "slash") return []
    const q = trigger.query.toLowerCase()
    return SLASH_COMMANDS.filter(
      (c) =>
        c.id.toLowerCase().startsWith(q) ||
        c.label.toLowerCase().includes(q) ||
        c.usage.toLowerCase().includes(q)
    )
  }, [trigger])

  const mentionMatches = useMemo(() => {
    if (!trigger || trigger.kind !== "mention") return []
    const q = trigger.query.trim().toLowerCase()
    if (!q) return []
    return mentionItems.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 14)
  }, [trigger, mentionItems])

  /** Require at least one typed character after `/` or `@` so bare triggers don’t block normal messages or steal Enter. */
  const slashMenuEligible =
    trigger?.kind === "slash" && trigger.query.length >= 1 && slashMatches.length > 0
  const mentionMenuEligible =
    trigger?.kind === "mention" &&
    trigger.query.trim().length >= 1 &&
    mentionMatches.length > 0

  const open =
    Boolean(isEditing) && Boolean(trigger && (slashMenuEligible || mentionMenuEligible))

  const slashMatchesForOpen = slashMenuEligible ? slashMatches : []
  const mentionMatchesForOpen = mentionMenuEligible ? mentionMatches : []
  const listLength =
    trigger?.kind === "slash" ? slashMatchesForOpen.length : mentionMatchesForOpen.length

  const syncTrigger = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    const tr = parseTrigger(el.value, el.selectionStart ?? el.value.length)
    setTrigger(tr)
    setHighlightIdx(0)
  }, [])

  const applyPick = useCallback(
    (kind: "slash" | "mention", value: string) => {
      const el = textareaRef.current
      if (!el || !trigger) return
      const { value: v, selectionStart } = el
      const before = v.slice(0, trigger.replaceFrom)
      const after = v.slice(selectionStart)
      const insertion = kind === "slash" ? `/${value} ` : `@${value} `
      const next = before + insertion + after
      aui.composer().setText(next)
      setTrigger(null)
      requestAnimationFrame(() => {
        const t = textareaRef.current
        if (!t) return
        const pos = before.length + insertion.length
        t.focus()
        t.setSelectionRange(pos, pos)
      })
    },
    [aui, trigger]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open || !trigger) return
      if (e.key === "Escape") {
        e.preventDefault()
        setTrigger(null)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightIdx((i) => (listLength ? (i + 1) % listLength : 0))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightIdx((i) => (listLength ? (i - 1 + listLength) % listLength : 0))
        return
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (trigger.kind === "slash" && slashMatchesForOpen[highlightIdx]) {
          applyPick("slash", slashMatchesForOpen[highlightIdx].id)
        } else if (trigger.kind === "mention" && mentionMatchesForOpen[highlightIdx]) {
          applyPick("mention", mentionMatchesForOpen[highlightIdx].label)
        }
      }
    },
    [
      open,
      trigger,
      listLength,
      highlightIdx,
      slashMatchesForOpen,
      mentionMatchesForOpen,
      applyPick,
    ]
  )

  return (
    <div className="relative w-full">
      {open ? (
        <ul
          className="absolute bottom-full left-2 z-[100] mb-1 max-h-52 min-w-[240px] max-w-[min(100vw-2rem,320px)] overflow-auto rounded-lg border-2 border-border bg-card p-1 text-sm text-card-foreground shadow-xl"
          role="listbox"
          aria-label={trigger?.kind === "slash" ? "Slash commands" : "Mentions"}
        >
          {trigger?.kind === "slash"
            ? slashMatchesForOpen.map((c, i) => (
                <li key={c.id} role="option" aria-selected={i === highlightIdx}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-xs text-foreground",
                      i === highlightIdx
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/80"
                    )}
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      applyPick("slash", c.id)
                    }}
                    onMouseEnter={() => setHighlightIdx(i)}
                  >
                    <span className="font-medium">{c.label}</span>
                    <span
                      className={cn(
                        "text-xs",
                        i === highlightIdx ? "text-primary-foreground/90" : "text-muted-foreground"
                      )}
                    >
                      {c.usage}
                    </span>
                  </button>
                </li>
              ))
            : mentionMatchesForOpen.map((m, i) => (
                <li key={m.key} role="option" aria-selected={i === highlightIdx}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground",
                      i === highlightIdx
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/80"
                    )}
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      applyPick("mention", m.label)
                    }}
                    onMouseEnter={() => setHighlightIdx(i)}
                  >
                    {m.label}
                  </button>
                </li>
              ))}
        </ul>
      ) : null}
      <ComposerPrimitive.Input
        {...rest}
        ref={(node) => {
          textareaRef.current = node
        }}
        className={className}
        onChange={(e) => {
          onChange?.(e)
          syncTrigger(e.currentTarget)
        }}
        onSelect={(e) => {
          onSelect?.(e)
          syncTrigger(e.currentTarget)
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (!e.defaultPrevented) handleKeyDown(e)
        }}
        placeholder={props.placeholder ?? "Send a message…"}
      />
    </div>
  )
}
