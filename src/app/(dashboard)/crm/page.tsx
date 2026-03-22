"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { UsersThree, Buildings, CurrencyDollar, ArrowRight } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export default function CrmHubPage() {
  const { contacts, companies, deals } = useWorkspace()

  const pipeline = deals
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + d.value, 0)

  const cards = [
    {
      title: "Contacts",
      description: "People and relationships",
      href: "/crm/contacts",
      icon: UsersThree,
      stat: `${contacts.length} total`,
    },
    {
      title: "Companies",
      description: "Accounts and organizations",
      href: "/crm/companies",
      icon: Buildings,
      stat: `${companies.length} total`,
    },
    {
      title: "Deals",
      description: "Pipeline and opportunities",
      href: "/crm/deals",
      icon: CurrencyDollar,
      stat: formatCurrency(pipeline),
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
        <p className="text-muted-foreground mt-1">
          Pipeline value (open stages):{" "}
          <span className="font-semibold text-foreground">{formatCurrency(pipeline)}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <c.icon size={22} className="text-muted-foreground" />
                {c.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{c.description}</p>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between">
              <span className="text-sm font-medium">{c.stat}</span>
              <Link
                href={c.href}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
              >
                Open
                <ArrowRight size={14} />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
