"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FolderPlus } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { parseKeyValueLines } from "@/lib/kv-lines"
import { toast } from "sonner"

const colors = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
]

export function CreateProjectModal() {
  const { addProject } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(colors[4].value)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "general",
    labels: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedLabels = parseKeyValueLines(formData.labels)
    const created = addProject({
      name: formData.name,
      description: formData.description,
      color: selectedColor,
      category: formData.category,
      customFields: Object.keys(parsedLabels).length ? parsedLabels : undefined,
    })
    toast.success(`Project “${created.name}” created`)
    setOpen(false)
    setFormData({ name: "", description: "", category: "general", labels: "" })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="default" size="sm" className="gap-2" />}
      >
        <FolderPlus size={16} />
        New Project
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project to organize your work and collaborate with your team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="e.g., Q2 Marketing Campaign"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your project goals and scope..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => {
                if (value != null)
                  setFormData({ ...formData, category: value })
              }}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="labels">Workspace labels (optional)</Label>
            <Textarea
              id="labels"
              placeholder="One key: value per line"
              value={formData.labels}
              onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-3">
              {colors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    selectedColor === color.value ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name}>
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
