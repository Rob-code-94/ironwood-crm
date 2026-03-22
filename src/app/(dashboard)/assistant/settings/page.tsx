import { CrmAiSettingsCard } from "@/components/crm-ai-settings-card"
import { Robot } from "@phosphor-icons/react/dist/ssr"

export default function AssistantSettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3">
          <Robot size={32} className="text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant Settings</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Configure your CRM assistant by setting your Gemini API key, selecting the AI model, and customizing the system prompt.
        </p>
      </div>

      <CrmAiSettingsCard />
    </div>
  )
}
