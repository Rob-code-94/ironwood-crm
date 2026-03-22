import { CrmAiSettingsCard } from "@/components/crm-ai-settings-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { User, Bell, Shield, Palette } from "@phosphor-icons/react/dist/ssr"

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences. To use the CRM assistant,{" "}
          <a
            className="font-medium text-foreground underline underline-offset-2"
            href="#gemini-api-key"
          >
            add your Gemini API key
          </a>{" "}
          in the section below.
        </p>
      </div>

      <CrmAiSettingsCard />

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User size={18} />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input defaultValue="Ironwood" />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input defaultValue="User" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" defaultValue="user@ironwoodcapital.com" />
          </div>
          <div className="space-y-1">
            <Label>Company</Label>
            <Input defaultValue="Ironwood Capital LLC" />
          </div>
          <Button>Save Profile</Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell size={18} />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Task due date reminders", description: "Get notified 24 hours before a task is due" },
            { label: "Deal stage changes", description: "Notify when a deal moves to a new stage" },
            { label: "New document uploads", description: "Alert when a document is uploaded" },
            { label: "Calendar event reminders", description: "Get reminded about upcoming meetings" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette size={18} />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark theme</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Compact sidebar</p>
              <p className="text-xs text-muted-foreground">Use icon-only sidebar by default</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={18} />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Current Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-1">
            <Label>New Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-1">
            <Label>Confirm Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button variant="outline">Update Password</Button>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
