export type CommandType = "task" | "search" | "client" | "help" | "resources" | "plan"

export interface CommandMatch {
  type: "command" | "mention"
  trigger: "/" | "@"
  text: string
  startIndex: number
  endIndex: number
}

export const SLASH_COMMANDS = [
  {
    id: "plan",
    label: "Plan Mode",
    description: "Describe all work and create a plan before adding tasks",
    usage: "/plan [describe work]",
  },
  {
    id: "task",
    label: "Create Task",
    description: "Create a new task or reminder",
    usage: "/task [description]",
  },
  {
    id: "search",
    label: "Search",
    description: "Search clients, documents, or resources",
    usage: "/search [query]",
  },
  {
    id: "client",
    label: "Client Info",
    description: "Get information about a specific client",
    usage: "/client [name]",
  },
  {
    id: "resources",
    label: "Resources",
    description: "Find lenders, bureaus, or legal references",
    usage: "/resources [query]",
  },
  {
    id: "help",
    label: "Help",
    description: "Show available commands",
    usage: "/help",
  },
] as const

export function parseCommandsAndMentions(text: string): CommandMatch | null {
  const commandRegex = /\/(\w+)/g
  const mentionRegex = /@(\w+(?:\s+\w+)*)/g
  let match: CommandMatch | null = null
  let commandMatch: RegExpExecArray | null = null
  let mentionMatch: RegExpExecArray | null = null

  while ((commandMatch = commandRegex.exec(text))) {
    match = {
      type: "command",
      trigger: "/",
      text: commandMatch[1],
      startIndex: commandMatch.index,
      endIndex: commandMatch.index + commandMatch[0].length,
    }
  }

  while ((mentionMatch = mentionRegex.exec(text))) {
    const next: CommandMatch = {
      type: "mention",
      trigger: "@",
      text: mentionMatch[1],
      startIndex: mentionMatch.index,
      endIndex: mentionMatch.index + mentionMatch[0].length,
    }
    if (!match || mentionMatch.index > match.startIndex) {
      match = next
    }
  }

  return match
}

export function getCommandContext(match: CommandMatch) {
  return {
    commandType: match.trigger === "/" ? match.text : null,
    mentionedClient: match.trigger === "@" ? match.text : null,
    trigger: match.trigger,
  }
}
