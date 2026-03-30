"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, CurrencyDollar, ArrowRight, PencilSimple } from "@phosphor-icons/react"
import type { Deal, DealStage } from "@/lib/types"
import { useWorkspace } from "@/lib/workspace/context"

const STAGES: { key: DealStage; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export default function DealsPage() {
  const { deals, contacts, addDeal, advanceDealStage, updateDeal } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [editFollowUp, setEditFollowUp] = useState("")
  const [editClose, setEditClose] = useState("")
  const [newDeal, setNewDeal] = useState({
    title: "",
    value: "",
    stage: "lead" as DealStage,
    contactId: "",
    followUpAt: "",
    closeDate: "",
  })

  function handleAddDeal() {
    if (!newDeal.title.trim()) return
    const c = contacts.find((x) => x.id === newDeal.contactId)
    addDeal({
      title: newDeal.title.trim(),
      value: Number(newDeal.value) || 0,
      stage: newDeal.stage,
      contactId: newDeal.contactId || undefined,
      contactName: c?.name,
      followUpAt: newDeal.followUpAt.trim() || undefined,
      closeDate: newDeal.closeDate.trim() || undefined,
    })
    setNewDeal({
      title: "",
      value: "",
      stage: "lead",
      contactId: "",
      followUpAt: "",
      closeDate: "",
    })
    setOpen(false)
  }

  function openEditDates(d: Deal) {
    setEditDeal(d)
    setEditFollowUp(d.followUpAt ?? "")
    setEditClose(d.closeDate ?? "")
  }

  function saveEditDates() {
    if (!editDeal) return
    updateDeal(editDeal.id, {
      followUpAt: editFollowUp.trim() || undefined,
      closeDate: editClose.trim() || undefined,
    })
    setEditDeal(null)
  }

  const totalPipeline = deals
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground mt-1">
            Pipeline: <span className="font-semibold text-foreground">{formatCurrency(totalPipeline)}</span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus size={16} className="mr-2" />
            New Deal
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Deal Title</Label>
                <Input placeholder="Service package name" value={newDeal.title} onChange={(e) => setNewDeal((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Value ($)</Label>
                <Input type="number" placeholder="0" value={newDeal.value} onChange={(e) => setNewDeal((p) => ({ ...p, value: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Contact</Label>
                <Select
                  value={newDeal.contactId || "none"}
                  onValueChange={(v) => {
                    if (v != null) setNewDeal((p) => ({ ...p, contactId: v === "none" ? "" : v }))
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contact</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Stage</Label>
                <Select
                  value={newDeal.stage}
                  onValueChange={(v) => {
                    if (v != null)
                      setNewDeal((p) => ({ ...p, stage: v as DealStage }))
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Follow-up</Label>
                  <Input
                    type="date"
                    value={newDeal.followUpAt}
                    onChange={(e) =>
                      setNewDeal((p) => ({ ...p, followUpAt: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Expected close</Label>
                  <Input
                    type="date"
                    value={newDeal.closeDate}
                    onChange={(e) =>
                      setNewDeal((p) => ({ ...p, closeDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleAddDeal}>Create Deal</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editDeal !== null} onOpenChange={(v) => !v && setEditDeal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deal dates</DialogTitle>
            </DialogHeader>
            {editDeal && (
              <div className="mt-2 space-y-4">
                <p className="text-sm text-muted-foreground">{editDeal.title}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Follow-up</Label>
                    <Input
                      type="date"
                      value={editFollowUp}
                      onChange={(e) => setEditFollowUp(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Expected close</Label>
                    <Input
                      type="date"
                      value={editClose}
                      onChange={(e) => setEditClose(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={saveEditDates}>
                  Save dates
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage.key)
          const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0)
          return (
            <div key={stage.key} className="min-w-[180px] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stage.label}</span>
                <Badge variant="outline" className="text-xs">{stageDeals.length}</Badge>
              </div>
              {stageValue > 0 && (
                <p className="px-1 text-xs text-muted-foreground">{formatCurrency(stageValue)}</p>
              )}
              <div className="space-y-2 min-h-[100px]">
                {stageDeals.map((deal) => (
                  <Card key={deal.id} className="transition-shadow hover:shadow-sm">
                    <CardContent className="space-y-2 p-3">
                      <p className="text-xs font-medium leading-tight">{deal.title}</p>
                      {deal.contactName && (
                        <p className="text-xs text-muted-foreground">{deal.contactName}</p>
                      )}
                      {(deal.followUpAt || deal.closeDate) && (
                        <div className="space-y-0.5 text-[10px] leading-tight text-muted-foreground">
                          {deal.followUpAt && <p>Follow-up {deal.followUpAt}</p>}
                          {deal.closeDate && <p>Close {deal.closeDate}</p>}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600">
                          <CurrencyDollar size={11} />
                          {formatCurrency(deal.value).replace("$", "")}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            type="button"
                            title="Edit follow-up and close dates"
                            onClick={() => openEditDates(deal)}
                          >
                            <PencilSimple size={12} />
                          </Button>
                          {!["won", "lost"].includes(deal.stage) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              type="button"
                              onClick={() => advanceDealStage(deal.id)}
                              title="Advance stage"
                            >
                              <ArrowRight size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
