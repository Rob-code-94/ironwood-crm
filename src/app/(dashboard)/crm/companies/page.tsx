"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, MagnifyingGlass, Buildings, PencilSimple } from "@phosphor-icons/react"
import { useWorkspace } from "@/lib/workspace/context"
import { parseKeyValueLines, recordToKeyValueLines } from "@/lib/kv-lines"
import type { Company } from "@/lib/types"

type CompanyForm = {
  name: string
  website: string
  industry: string
  size: string
  notes: string
  metadataLines: string
}

const emptyForm: CompanyForm = {
  name: "",
  website: "",
  industry: "",
  size: "",
  notes: "",
  metadataLines: "",
}

export default function CompaniesPage() {
  const { companies, addCompany, updateCompany } = useWorkspace()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [newCompany, setNewCompany] = useState<CompanyForm>({ ...emptyForm })
  const [editing, setEditing] = useState<Company | null>(null)
  const [editForm, setEditForm] = useState<CompanyForm>({ ...emptyForm })

  function beginEditCompany(company: Company) {
    setEditForm({
      name: company.name,
      website: company.website ?? "",
      industry: company.industry ?? "",
      size: company.size ?? "",
      notes: company.notes ?? "",
      metadataLines: recordToKeyValueLines(company.metadata),
    })
    setEditing(company)
  }

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.industry ?? "").toLowerCase().includes(search.toLowerCase())
  )

  function handleAddCompany() {
    if (!newCompany.name.trim()) return
    const meta = parseKeyValueLines(newCompany.metadataLines)
    addCompany({
      name: newCompany.name.trim(),
      website: newCompany.website.trim() || undefined,
      industry: newCompany.industry.trim() || undefined,
      size: newCompany.size.trim() || undefined,
      notes: newCompany.notes.trim() || undefined,
      metadata: Object.keys(meta).length ? meta : undefined,
    })
    setNewCompany({ ...emptyForm })
    setOpen(false)
  }

  function saveEdit() {
    if (!editing || !editForm.name.trim()) return
    const meta = parseKeyValueLines(editForm.metadataLines)
    updateCompany(editing.id, {
      name: editForm.name.trim(),
      website: editForm.website.trim() || undefined,
      industry: editForm.industry.trim() || undefined,
      size: editForm.size.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
      metadata: Object.keys(meta).length ? meta : undefined,
    })
    setEditing(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-1">{companies.length} companies</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus size={16} className="mr-2" />
            Add Company
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Company</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {(
                [
                  { label: "Company Name", key: "name", placeholder: "Acme Corp" },
                  { label: "Website", key: "website", placeholder: "acme.com" },
                  { label: "Industry", key: "industry", placeholder: "Technology" },
                  { label: "Size", key: "size", placeholder: "10-50" },
                ] as const
              ).map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    placeholder={placeholder}
                    value={newCompany[key]}
                    onChange={(e) => setNewCompany((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={newCompany.notes}
                  onChange={(e) => setNewCompany((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Free-form notes…"
                />
              </div>
              <div className="space-y-1">
                <Label>Facts (key: value per line)</Label>
                <Textarea
                  rows={3}
                  className="font-mono text-sm"
                  value={newCompany.metadataLines}
                  onChange={(e) =>
                    setNewCompany((p) => ({ ...p, metadataLines: e.target.value }))
                  }
                  placeholder="Timeline: Net 30"
                />
              </div>
              <Button className="w-full" onClick={handleAddCompany}>
                Create Company
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {(
              [
                { label: "Company Name", key: "name", placeholder: "Acme Corp" },
                { label: "Website", key: "website", placeholder: "acme.com" },
                { label: "Industry", key: "industry", placeholder: "Technology" },
                { label: "Size", key: "size", placeholder: "10-50" },
              ] as const
            ).map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  placeholder={placeholder}
                  value={editForm[key]}
                  onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Facts (key: value per line)</Label>
              <Textarea
                rows={3}
                className="font-mono text-sm"
                value={editForm.metadataLines}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, metadataLines: e.target.value }))
                }
              />
            </div>
            <Button className="w-full" onClick={saveEdit}>
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search companies..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Industry</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Size</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Website</th>
              <th className="px-4 py-3 text-left font-medium">Contacts</th>
              <th className="px-4 py-3 text-right font-medium w-24"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((company, i) => (
              <tr
                key={company.id}
                className={
                  i < filtered.length - 1 ? "border-b hover:bg-muted/30" : "hover:bg-muted/30"
                }
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <Buildings size={16} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium">{company.name}</span>
                      {company.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {company.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {company.industry}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                  {company.size} employees
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {company.website}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{company.contactCount}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => beginEditCompany(company)}
                    aria-label={`Edit ${company.name}`}
                  >
                    <PencilSimple size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
