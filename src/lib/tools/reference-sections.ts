/**
 * Generic reference / SOP sections. Replace content for your playbook;
 * layout is driven only by this structure.
 */
export type ReferenceSection = {
  id: string
  title: string
  accent?: "default" | "warning" | "info"
  intro?: string
  bullets?: string[]
}

export const defaultReferenceSections: ReferenceSection[] = [
  {
    id: "overview",
    title: "How to use this page",
    accent: "info",
    intro:
      "This is a template for policies, SOPs, or compliance notes. Edit reference-sections.ts or replace with CMS content later.",
    bullets: [
      "Keep sections short and scannable.",
      "Link related tasks from the Tasks or Playbook views.",
      "Use your real procedures—nothing here is legal or medical advice.",
    ],
  },
  {
    id: "workflow",
    title: "Example workflow checklist",
    accent: "default",
    bullets: [
      "Confirm scope and owner.",
      "Document assumptions and links to primary sources.",
      "Review on a schedule; update tasks when rules change.",
    ],
  },
  {
    id: "cautions",
    title: "Important reminders",
    accent: "warning",
    intro: "Use this block for anything that must not be missed.",
    bullets: [
      "Verify requirements with your counsel or regulator where applicable.",
      "Do not store secrets or API keys in client-side content files.",
    ],
  },
]
