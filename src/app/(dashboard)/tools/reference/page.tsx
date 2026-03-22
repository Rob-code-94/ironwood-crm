import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { defaultReferenceSections } from "@/lib/tools/reference-sections"
import { BookOpen } from "@phosphor-icons/react/dist/ssr"

const accentBorder: Record<string, string> = {
  default: "border-t-primary",
  info: "border-t-blue-500",
  warning: "border-t-amber-500",
}

export default function ToolsReferencePage() {
  const sections = defaultReferenceSections

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen size={28} className="text-muted-foreground" />
          Reference
        </h1>
        <p className="text-muted-foreground mt-1">
          Generic SOP / policy layout. Content lives in{" "}
          <code className="text-xs bg-muted px-1 rounded">reference-sections.ts</code>.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((sec) => (
          <Card
            key={sec.id}
            className={`border-t-4 ${accentBorder[sec.accent ?? "default"]}`}
          >
            <CardHeader>
              <CardTitle className="text-lg">{sec.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {sec.intro && <p className="leading-relaxed">{sec.intro}</p>}
              {sec.bullets && sec.bullets.length > 0 && (
                <ul className="list-disc pl-5 space-y-2">
                  {sec.bullets.map((b, i) => (
                    <li key={i} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
