import type { jsPDF } from "jspdf"
import type { Task, TaskStatus } from "@/lib/types"
import { groupProjectTasksIntoSections } from "@/lib/playbook-sections"

function safeFilePart(name: string) {
  const t = name.replace(/[^\w\d\- .]+/g, "").trim().slice(0, 72)
  return t.length ? t : "playbook"
}

function statusLabel(s: TaskStatus): string {
  switch (s) {
    case "done":
      return "Done"
    case "in-progress":
      return "In progress"
    case "review":
      return "In review"
    case "todo":
      return "To do"
  }
}

function parseDueDate(raw: string): Date | null {
  const t = raw.trim()
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function estimateCompletionSummary(
  projectDueDate: string | undefined,
  projectTasks: Task[]
): { primary: string; secondary: string } {
  const pd = projectDueDate?.trim() ? parseDueDate(projectDueDate) : null
  if (pd) {
    return {
      primary: formatLongDate(pd),
      secondary: "Based on the project target date in Ironwood Planner.",
    }
  }

  const open = projectTasks.filter((t) => t.status !== "done")
  const openDates = open
    .map((t) => (t.dueDate ? parseDueDate(t.dueDate) : null))
    .filter((d): d is Date => d != null)
  if (openDates.length > 0) {
    const latest = new Date(Math.max(...openDates.map((d) => d.getTime())))
    return {
      primary: formatLongDate(latest),
      secondary: "Based on the latest due date among open tasks (to do, in progress, in review).",
    }
  }

  const anyDates = projectTasks
    .map((t) => (t.dueDate ? parseDueDate(t.dueDate) : null))
    .filter((d): d is Date => d != null)
  if (anyDates.length > 0) {
    const latest = new Date(Math.max(...anyDates.map((d) => d.getTime())))
    return {
      primary: formatLongDate(latest),
      secondary: "Based on the latest due date on any task (includes completed items).",
    }
  }

  return {
    primary: "Not available",
    secondary:
      "Add a project target date or due dates on tasks to include an estimated completion in this report.",
  }
}

const MM_PAGE_BOTTOM = 287
const MARGIN = 16
const CONTENT_W = 210 - MARGIN * 2
const LINE = 5.1
const BODY = 9.5
const SUB = 8.5
const H1 = 17
const H2 = 11.5
const ACCENT = { r: 24, g: 24, b: 27 } as const
const MUTED = { r: 100, g: 100, b: 108 } as const
const BORDER = { r: 228, g: 228, b: 231 } as const
const PANEL_BG = { r: 250, g: 250, b: 251 } as const
const BAR_DONE = { r: 22, g: 163, b: 74 } as const
const BAR_PROGRESS = { r: 59, g: 130, b: 246 } as const
const BAR_TODO = { r: 180, g: 180, b: 186 } as const

function drawFooters(doc: jsPDF, pageCount: number) {
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, MM_PAGE_BOTTOM - 12, 210 - MARGIN, MM_PAGE_BOTTOM - 12)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text("Ironwood Planner", MARGIN, MM_PAGE_BOTTOM - 6)
    doc.text(`Page ${i} of ${pageCount}`, 210 - MARGIN, MM_PAGE_BOTTOM - 6, { align: "right" })
    doc.setTextColor(0, 0, 0)
  }
}

/** Client-only: builds an A4 PDF of the playbook for sharing */
export async function downloadPlaybookPdf(
  projectName: string,
  projectId: string,
  tasks: Task[],
  options?: { projectDueDate?: string }
) {
  const { default: jsPDF } = await import("jspdf/dist/jspdf.es.min.js")

  const projectTasks = tasks.filter((t) => t.projectId === projectId)
  const sections = groupProjectTasksIntoSections(tasks, projectId)
  const total = projectTasks.length

  const done = projectTasks.filter((t) => t.status === "done").length
  const inProgress = projectTasks.filter((t) => t.status === "in-progress").length
  const review = projectTasks.filter((t) => t.status === "review").length
  const todo = projectTasks.filter((t) => t.status === "todo").length

  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10)

  const pctDone = pct(done)
  const pctInProgress = pct(inProgress + review)
  const pctTodo = pct(todo)

  const estimate = estimateCompletionSummary(options?.projectDueDate, projectTasks)

  const doc = new jsPDF({ unit: "mm", format: "a4" })
  let y = MARGIN

  const ensure = (h: number) => {
    if (y + h > MM_PAGE_BOTTOM - MARGIN - 14) {
      doc.addPage()
      y = MARGIN
    }
  }

  // —— Header strip ——
  doc.setFillColor(PANEL_BG.r, PANEL_BG.g, PANEL_BG.b)
  doc.rect(0, 0, 210, 38, "F")
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.rect(0, 0, 3.2, 38, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(H1)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text("Playbook", MARGIN + 2, 20)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(BODY)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const sub = doc.splitTextToSize(projectName, CONTENT_W - 4) as string[]
  doc.text(sub, MARGIN + 2, 28)
  doc.setTextColor(0, 0, 0)

  y = 46

  const generated = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  // —— Summary panel ——
  const panelTop = y
  ensure(64)
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.setLineWidth(0.35)
  doc.roundedRect(MARGIN, panelTop, CONTENT_W, 56, 2, 2, "FD")

  y = panelTop + 7
  doc.setFont("helvetica", "bold")
  doc.setFontSize(H2)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text("Progress overview", MARGIN + 5, y)
  y += 7

  doc.setFont("helvetica", "normal")
  doc.setFontSize(SUB)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text(`${total} task${total === 1 ? "" : "s"} · Report generated ${generated}`, MARGIN + 5, y)
  y += 8
  doc.setTextColor(0, 0, 0)

  // Stacked bar (done | in progress+review | todo)
  const barX = MARGIN + 5
  const barY = y
  const barW = CONTENT_W - 10
  const barH = 4.2
  if (total > 0) {
    const wDone = (barW * done) / total
    const wMid = (barW * (inProgress + review)) / total
    const wTodo = (barW * todo) / total
    let x = barX
    if (wDone > 0.2) {
      doc.setFillColor(BAR_DONE.r, BAR_DONE.g, BAR_DONE.b)
      doc.rect(x, barY, wDone, barH, "F")
      x += wDone
    }
    if (wMid > 0.2) {
      doc.setFillColor(BAR_PROGRESS.r, BAR_PROGRESS.g, BAR_PROGRESS.b)
      doc.rect(x, barY, wMid, barH, "F")
      x += wMid
    }
    if (wTodo > 0.2) {
      doc.setFillColor(BAR_TODO.r, BAR_TODO.g, BAR_TODO.b)
      doc.rect(x, barY, wTodo, barH, "F")
    }
    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
    doc.setLineWidth(0.15)
    doc.rect(barX, barY, barW, barH, "S")
  } else {
    doc.setFillColor(240, 240, 242)
    doc.rect(barX, barY, barW, barH, "FD")
  }
  y = barY + barH + 3
  doc.setFont("helvetica", "normal")
  doc.setFontSize(SUB - 0.5)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text(
    "Green = done  ·  Blue = in progress & review  ·  Gray = to do",
    MARGIN + 5,
    y
  )
  doc.setTextColor(0, 0, 0)
  y += 5.5

  doc.setFontSize(BODY)
  const activeLabel =
    inProgress + review === 0
      ? "0"
      : review === 0
        ? String(inProgress)
        : inProgress === 0
          ? `${review} in review`
          : `${inProgress} active, ${review} in review`

  const statLines = [
    `Done: ${pctDone}% (${done} task${done === 1 ? "" : "s"})`,
    `In progress (incl. review): ${pctInProgress}% (${activeLabel})`,
    `To do: ${pctTodo}% (${todo} task${todo === 1 ? "" : "s"})`,
  ]
  for (const line of statLines) {
    doc.setFont("helvetica", "normal")
    doc.text(line, MARGIN + 5, y)
    y += LINE
  }

  y = panelTop + 56 + 8

  // —— Estimated completion ——
  ensure(28)
  doc.setFillColor(PANEL_BG.r, PANEL_BG.g, PANEL_BG.b)
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2, 2, "FD")
  const estY = y + 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(H2)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text("Estimated completion", MARGIN + 5, estY)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(BODY)
  doc.setTextColor(0, 0, 0)
  doc.text(estimate.primary, MARGIN + 5, estY + 6)
  doc.setFontSize(SUB)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  const estNote = doc.splitTextToSize(estimate.secondary, CONTENT_W - 10) as string[]
  doc.text(estNote, MARGIN + 5, estY + 11)
  doc.setTextColor(0, 0, 0)
  y += 28

  y += 4

  if (sections.length === 0) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(BODY)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    const msg = doc.splitTextToSize(
      "No tasks in this playbook yet. Add tasks with section names to build your client-ready checklist.",
      CONTENT_W
    ) as string[]
    ensure(msg.length * LINE + 4)
    doc.text(msg, MARGIN, y)
    doc.setTextColor(0, 0, 0)
    drawFooters(doc, doc.getNumberOfPages())
    doc.save(`${safeFilePart(projectName)}-playbook.pdf`)
    return
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(H2 + 1)
  doc.text("Checklist by section", MARGIN, y)
  y += 9

  for (const [sectionName, sectionTasks] of sections) {
    const secDone = sectionTasks.filter((t) => t.status === "done").length
    ensure(LINE * 4 + 8)

    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
    doc.setLineWidth(0.25)
    doc.line(MARGIN, y, MARGIN + 1.8, y + 9)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(H2)
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
    doc.text(sectionName, MARGIN + 4, y + 6)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(SUB)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(`${secDone}/${sectionTasks.length} complete`, 210 - MARGIN, y + 6, { align: "right" })
    doc.setTextColor(0, 0, 0)
    y += 12

    for (const task of sectionTasks) {
      const mark = task.status === "done" ? "[x]" : "[ ]"
      const head = `${mark}  ${task.title}`
      const statusSuffix = `  (${statusLabel(task.status)})`

      doc.setFont("helvetica", task.status === "done" ? "normal" : "bold")
      doc.setFontSize(BODY)
      const headLines = doc.splitTextToSize(head + statusSuffix, CONTENT_W - 4) as string[]
      ensure(headLines.length * LINE + 2)
      doc.text(headLines, MARGIN + 2, y)
      y += headLines.length * LINE + 0.5

      if (task.description?.trim()) {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(BODY - 1)
        doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
        const descLines = doc.splitTextToSize(task.description.trim(), CONTENT_W - 8) as string[]
        ensure(descLines.length * (LINE - 0.4) + 2)
        doc.text(descLines, MARGIN + 5, y)
        y += descLines.length * (LINE - 0.4) + 1.5
        doc.setFont("helvetica", "normal")
        doc.setTextColor(0, 0, 0)
      }

      if (task.links?.length) {
        doc.setFontSize(SUB)
        doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
        for (const l of task.links) {
          const line = `• ${l.label}: ${l.href}`
          const wrapped = doc.splitTextToSize(line, CONTENT_W - 8) as string[]
          ensure(wrapped.length * LINE + 1)
          doc.text(wrapped, MARGIN + 5, y)
          y += wrapped.length * LINE
        }
        doc.setTextColor(0, 0, 0)
      }

      y += 3.5
    }
    y += 4
  }

  drawFooters(doc, doc.getNumberOfPages())
  doc.save(`${safeFilePart(projectName)}-playbook.pdf`)
}
