"use client"

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react"
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react"
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown"
import "@assistant-ui/react-markdown/styles/dot.css"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MarkdownText: TextMessagePartComponent = () => (
  <MarkdownTextPrimitive className="aui-md max-w-none text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5" />
)

const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => (
  <div className="my-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
    <p className="font-medium text-foreground">Tool: {toolName}</p>
    {argsText ? (
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
        {argsText}
      </pre>
    ) : null}
    {result !== undefined ? (
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">
        {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
      </pre>
    ) : null}
    {status?.type === "running" ? (
      <p className="mt-1 text-xs text-muted-foreground">Running…</p>
    ) : null}
  </div>
)

function ComposerAttachmentTile() {
  return (
    <AttachmentPrimitive.Root className="flex h-14 max-w-[200px] items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-2 py-1">
      <span className="truncate text-xs font-medium">
        <AttachmentPrimitive.Name />
      </span>
      <AttachmentPrimitive.Remove asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-7 shrink-0"
          title="Remove attachment"
        >
          <XIcon className="size-3.5" />
        </Button>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  )
}

function ComposerAttachments() {
  return (
    <div className="flex flex-wrap gap-2 px-3 pt-1">
      <ComposerPrimitive.Attachments
        components={{
          Image: ComposerAttachmentTile,
          Document: ComposerAttachmentTile,
          File: ComposerAttachmentTile,
          Attachment: ComposerAttachmentTile,
        }}
      />
    </div>
  )
}

function ComposerAddAttachment() {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title="Add attachment"
      >
        <PlusIcon className="size-4" />
      </Button>
    </ComposerPrimitive.AddAttachment>
  )
}

function UserAttachmentTile() {
  return (
    <AttachmentPrimitive.Root className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/30 px-2 py-1 text-xs">
      <span className="truncate font-medium">
        <AttachmentPrimitive.Name />
      </span>
    </AttachmentPrimitive.Root>
  )
}

function UserMessageAttachments() {
  return (
    <div className="col-start-1 flex flex-wrap content-start gap-2">
      <MessagePrimitive.Attachments
        components={{
          Image: UserAttachmentTile,
          Document: UserAttachmentTile,
          File: UserAttachmentTile,
          Attachment: UserAttachmentTile,
        }}
      />
    </div>
  )
}

export function Thread() {
  return (
    <ThreadPrimitive.Root
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-background text-sm"
      style={
        {
          "--thread-max-width": "44rem",
          "--accent-color": "var(--primary)",
          "--accent-foreground": "var(--primary-foreground)",
        } as React.CSSProperties
      }
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth"
      >
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-2">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              EditComposer,
              AssistantMessage,
            }}
          />

          <AuiIf condition={(s) => !s.thread.isEmpty}>
            <div className="min-h-4 flex-1 shrink-0" aria-hidden />
          </AuiIf>
        </div>
      </ThreadPrimitive.Viewport>

      <ThreadPrimitive.ViewportFooter className="flex-0 shrink-0 border-t border-border/60 bg-background px-3 pt-3 pb-3 shadow-[0_-8px_24px_-8px_hsl(0_0%_0%/0.08)] dark:shadow-[0_-8px_24px_-8px_hsl(0_0%_0%/0.35)]">
        <div className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-3">
          <div className="flex justify-center">
            <ThreadPrimitive.ScrollToBottom asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                title="Scroll to bottom"
              >
                <ArrowDownIcon className="size-4" />
                <span className="sr-only">Scroll to bottom</span>
              </Button>
            </ThreadPrimitive.ScrollToBottom>
          </div>
          <Composer />
        </div>
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Root>
  )
}

function ThreadWelcome() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-6 py-4">
      <div className="px-2">
        <div className="text-2xl font-semibold">Hello there!</div>
        <div className="text-2xl text-muted-foreground/65">
          How can I help you today?
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Drag files into the composer below or use the + button to attach documents and images.
        </p>
      </div>
      <div className="grid w-full gap-2 md:grid-cols-2">
        <ThreadPrimitive.Suggestion
          prompt="Summarize my open deals and next steps"
          asChild
        >
          <Button
            variant="ghost"
            className="h-auto w-full flex-col items-start justify-start gap-1 rounded-2xl border px-5 py-4 text-left text-sm"
          >
            <span className="font-medium">Deal summary</span>
            <span className="text-muted-foreground">Open deals &amp; next steps</span>
          </Button>
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion
          prompt="Create 3 follow-up tasks for the Acme opportunity"
          asChild
        >
          <Button
            variant="ghost"
            className="h-auto w-full flex-col items-start justify-start gap-1 rounded-2xl border px-5 py-4 text-left text-sm"
          >
            <span className="font-medium">Task ideas</span>
            <span className="text-muted-foreground">For the Acme opportunity</span>
          </Button>
        </ThreadPrimitive.Suggestion>
      </div>
    </div>
  )
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="flex w-full flex-col gap-0">
      <ComposerPrimitive.AttachmentDropzone className="flex w-full flex-col gap-2 rounded-2xl border border-input bg-background p-2 outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-dashed data-[dragging=true]:border-primary/50 data-[dragging=true]:bg-muted/40">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message…"
          className="min-h-12 w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  )
}

function ComposerAction() {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-1">
      <ComposerAddAttachment />

      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "var(--accent-foreground)",
            }}
            title="Send message"
            aria-label="Send message"
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        </ComposerPrimitive.Send>
      </AuiIf>

      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "var(--accent-foreground)",
            }}
            title="Stop generating"
            aria-label="Stop generating"
          >
            <SquareIcon className="size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root
      className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-1 py-3 fade-in slide-in-from-bottom-1 animate-in duration-150"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="relative col-start-2 min-w-0">
        <div className="rounded-2xl bg-muted px-4 py-2.5 break-words text-foreground">
          <MessagePrimitive.Parts />
        </div>
        <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  )
}

function UserActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <Button type="button" variant="ghost" size="icon" className="p-4" title="Edit">
          <PencilIcon />
        </Button>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

function EditComposer() {
  return (
    <MessagePrimitive.Root className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col px-2 py-3">
      <ComposerPrimitive.Root className="ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
        />
        <div className="mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root
      className="relative mx-auto flex w-full max-w-[var(--thread-max-width)] gap-3 py-3 fade-in slide-in-from-bottom-1 animate-in duration-150"
      data-role="assistant"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <BotIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 break-words leading-relaxed text-foreground">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallback },
          }}
        />
        <MessageError />
        <AuiIf
          condition={(s) =>
            s.thread.isRunning && s.message.content.length === 0
          }
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <LoaderIcon className="size-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        </AuiIf>
        <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

function MessageError() {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="-ml-1 flex flex-wrap gap-1 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </Button>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.ExportMarkdown asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          title="Export as Markdown"
        >
          <DownloadIcon />
        </Button>
      </ActionBarPrimitive.ExportMarkdown>
      <ActionBarPrimitive.Reload asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Refresh">
          <RefreshCwIcon />
        </Button>
      </ActionBarPrimitive.Reload>

      <ActionBarPrimitive.FeedbackPositive asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          title="Good response"
        >
          <ThumbsUpIcon />
        </Button>
      </ActionBarPrimitive.FeedbackPositive>
      <ActionBarPrimitive.FeedbackNegative asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          title="Bad response"
        >
          <ThumbsDownIcon />
        </Button>
      </ActionBarPrimitive.FeedbackNegative>
    </ActionBarPrimitive.Root>
  )
}

function BranchPicker({ className }: { className?: string }) {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "mr-2 -ml-2 inline-flex items-center text-xs text-muted-foreground",
        className
      )}
    >
      <BranchPickerPrimitive.Previous asChild>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Previous">
          <ChevronLeftIcon />
        </Button>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Next">
          <ChevronRightIcon />
        </Button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
