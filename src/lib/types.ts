export type Priority = "low" | "medium" | "high" | "urgent"
export type TaskStatus = "todo" | "in-progress" | "review" | "done"
export type ProjectLifecycleStatus = "active" | "planning" | "completed" | "archived"
export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
export type DocumentType = "pdf" | "image" | "spreadsheet" | "document" | "other"

/** Clickable resource (portal, doc, phone as tel:, etc.) — reusable across entities */
export interface ResourceLink {
  label: string
  href: string
}

export interface Project {
  id: string
  name: string
  description?: string
  color: string
  createdAt: string
  updatedAt: string
  /** Workspace metadata for UI (not required for minimal Project) */
  category?: string
  status?: ProjectLifecycleStatus
  progress?: number
  members?: number
  dueDate?: string
  /** Arbitrary key-value labels for any vertical (e.g. IDs, codes) */
  customFields?: Record<string, string>
  /**
   * Saved logins for this project (local workspace only, not encrypted).
   * Prefer a real password manager for highly sensitive accounts.
   */
  passwordEntries?: ProjectPasswordEntry[]
  /** @deprecated Use `passwordEntries`; migrated automatically in the project UI */
  passwordVault?: string
  /** Inline notes for this project (not file uploads — see documents). */
  notes?: ProjectNote[]
}

export interface ProjectPasswordEntry {
  id: string
  /** e.g. "CAQH ProView" */
  label?: string
  login?: string
  password?: string
  url?: string
}

/** Short scratch notes / mini-docs scoped to one project (plain text, local workspace). */
export interface ProjectNote {
  id: string
  title: string
  body: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description?: string
  projectId?: string
  projectName?: string
  status: TaskStatus
  priority: Priority
  dueDate?: string
  assignee?: string
  createdAt: string
  /** Group tasks in playbook / checklist views */
  section?: string
  tags?: string[]
  /** Sort within a section (lower first) */
  sortOrder?: number
  links?: ResourceLink[]
}

export interface Document {
  id: string
  name: string
  url: string | null
  size: number
  type: DocumentType
  projectId?: string
  projectName?: string
  uploadedAt: string
  /** Optional small data URL preview for images (local only; capped size at upload). */
  previewDataUrl?: string
}

export interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  tags: string[]
  createdAt: string
  notes?: string
  /** Flexible key-value facts for any CRM use case */
  metadata?: Record<string, string>
}

export interface Company {
  id: string
  name: string
  website?: string
  industry?: string
  size?: string
  contactCount: number
  createdAt: string
  notes?: string
  metadata?: Record<string, string>
}

export interface Deal {
  id: string
  title: string
  value: number
  stage: DealStage
  contactId?: string
  contactName?: string
  projectId?: string
  createdAt: string
  /** Expected close date (YYYY-MM-DD, local calendar). */
  closeDate?: string
  /** Follow-up / next touch date (YYYY-MM-DD, local calendar). */
  followUpAt?: string
}

export interface CalendarEvent {
  id: string
  title: string
  /** YYYY-MM-DD local calendar date */
  date: string
  type: "task" | "meeting" | "deadline"
  refId?: string
  /** HTML time input value e.g. "14:30", or empty for all-day */
  time?: string
  description?: string
}

/** Persisted Q&A from advisor chat (generic, any project) */
export interface SavedChatTurn {
  id: string
  question: string
  answer: string
  createdAt: string
  projectId?: string
}
