"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, MagnifyingGlass, Envelope, Phone, PencilSimple } from "@phosphor-icons/react"
import { useWorkspace } from "@/lib/workspace/context"
import { parseKeyValueLines, recordToKeyValueLines } from "@/lib/kv-lines"
import type { Contact } from "@/lib/types"

type ContactForm = {
  name: string
  email: string
  phone: string
  company: string
  notes: string
  metadataLines: string
}

const emptyForm: ContactForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  notes: "",
  metadataLines: "",
}

export default function ContactsPage() {
  const { contacts, addContact, updateContact } = useWorkspace()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [newContact, setNewContact] = useState<ContactForm>({ ...emptyForm })
  const [editing, setEditing] = useState<Contact | null>(null)
  const [editForm, setEditForm] = useState<ContactForm>({ ...emptyForm })

  function beginEditContact(contact: Contact) {
    setEditForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? "",
      company: contact.company ?? "",
      notes: contact.notes ?? "",
      metadataLines: recordToKeyValueLines(contact.metadata),
    })
    setEditing(contact)
  }

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? "").toLowerCase().includes(search.toLowerCase())
  )

  function handleAddContact() {
    if (!newContact.name.trim()) return
    const meta = parseKeyValueLines(newContact.metadataLines)
    addContact({
      name: newContact.name.trim(),
      email: newContact.email.trim() || "unknown@example.com",
      phone: newContact.phone.trim() || undefined,
      company: newContact.company.trim() || undefined,
      notes: newContact.notes.trim() || undefined,
      metadata: Object.keys(meta).length ? meta : undefined,
      tags: [],
    })
    setNewContact({ ...emptyForm })
    setOpen(false)
  }

  function saveEdit() {
    if (!editing || !editForm.name.trim()) return
    const meta = parseKeyValueLines(editForm.metadataLines)
    updateContact(editing.id, {
      name: editForm.name.trim(),
      email: editForm.email.trim() || editing.email,
      phone: editForm.phone.trim() || undefined,
      company: editForm.company.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
      metadata: Object.keys(meta).length ? meta : undefined,
    })
    setEditing(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1">{contacts.length} contacts</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button />}>
            <Plus size={16} className="mr-2" />
            Add Contact
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>New Contact</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {(
                [
                  { label: "Full Name", key: "name", placeholder: "John Doe" },
                  { label: "Email", key: "email", placeholder: "john@example.com" },
                  { label: "Phone", key: "phone", placeholder: "+1 (555) 000-0000" },
                  { label: "Company", key: "company", placeholder: "Company name" },
                ] as const
              ).map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    placeholder={placeholder}
                    value={newContact[key]}
                    onChange={(e) => setNewContact((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={newContact.notes}
                  onChange={(e) => setNewContact((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Facts (key: value per line)</Label>
                <Textarea
                  rows={3}
                  className="font-mono text-sm"
                  value={newContact.metadataLines}
                  onChange={(e) =>
                    setNewContact((p) => ({ ...p, metadataLines: e.target.value }))
                  }
                />
              </div>
              <Button className="w-full" onClick={handleAddContact}>
                Create Contact
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {(
              [
                { label: "Full Name", key: "name", placeholder: "John Doe" },
                { label: "Email", key: "email", placeholder: "john@example.com" },
                { label: "Phone", key: "phone", placeholder: "+1 (555) 000-0000" },
                { label: "Company", key: "company", placeholder: "Company name" },
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
          placeholder="Search contacts..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Email</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Phone</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Company</th>
              <th className="px-4 py-3 text-left font-medium">Tags</th>
              <th className="px-4 py-3 text-right w-24"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No contacts found.
                </td>
              </tr>
            ) : (
              filtered.map((contact, i) => (
                <tr
                  key={contact.id}
                  className={
                    i < filtered.length - 1 ? "border-b hover:bg-muted/30" : "hover:bg-muted/30"
                  }
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {contact.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{contact.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Envelope size={12} />
                      {contact.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} />
                        {contact.phone}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {contact.company}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => beginEditContact(contact)}
                      aria-label={`Edit ${contact.name}`}
                    >
                      <PencilSimple size={16} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
