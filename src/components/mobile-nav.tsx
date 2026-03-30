"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { Hamburger, X } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "AI assistant", href: "/assistant" },
  { label: "Tasks", href: "/tasks" },
  { label: "Board", href: "/tasks/board" },
  { label: "Projects", href: "/projects" },
  { label: "Calendar", href: "/calendar" },
  { label: "Documents", href: "/documents" },
  { label: "Calculator", href: "/tools/calculator" },
  { label: "Reference", href: "/tools/reference" },
  { label: "Advisor", href: "/tools/advisor" },
  { label: "Analytics", href: "/analytics" },
  { label: "CRM", href: "/crm" },
  { label: "Settings", href: "/settings" },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden"
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Hamburger size={20} />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-bold text-lg">Ironwood</h2>
            <SheetClose
              render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
            >
              <X size={16} />
            </SheetClose>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <SheetClose
                key={item.href}
                nativeButton={false}
                render={
                  <Link
                    href={item.href}
                    className="block px-4 py-2 rounded-md hover:bg-muted transition-colors text-sm font-medium"
                  />
                }
              >
                {item.label}
              </SheetClose>
            ))}
          </nav>

          <div className="p-4 border-t text-xs text-muted-foreground">
            <p>Version 1.0.0</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
