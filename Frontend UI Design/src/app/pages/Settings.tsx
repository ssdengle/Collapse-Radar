import { Bell, Lock, Shield, User, Globe, Moon, Sun } from "lucide-react";

export function Settings() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 text-collapse-text">
      <div>
        <h1 className="text-3xl font-bold font-sans tracking-tight">Settings</h1>
        <p className="text-collapse-muted mt-2">Manage your account preferences and system configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar for settings */}
        <div className="space-y-1">
          <SettingsTab active label="General" icon={<User className="w-4 h-4" />} />
          <SettingsTab label="Notifications" icon={<Bell className="w-4 h-4" />} />
          <SettingsTab label="Security" icon={<Shield className="w-4 h-4" />} />
          <SettingsTab label="Network" icon={<Globe className="w-4 h-4" />} />
          <SettingsTab label="Privacy" icon={<Lock className="w-4 h-4" />} />
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 border-b border-collapse-border pb-2">Profile Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-collapse-muted">First Name</label>
                  <input type="text" defaultValue="Admin" className="w-full bg-collapse-bg border border-collapse-border rounded-lg px-4 py-2 text-collapse-text focus:border-collapse-accent focus:ring-1 focus:ring-collapse-accent outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-collapse-muted">Last Name</label>
                  <input type="text" defaultValue="User" className="w-full bg-collapse-bg border border-collapse-border rounded-lg px-4 py-2 text-collapse-text focus:border-collapse-accent focus:ring-1 focus:ring-collapse-accent outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-collapse-muted">Email Address</label>
                <input type="email" defaultValue="admin@system.local" className="w-full bg-collapse-bg border border-collapse-border rounded-lg px-4 py-2 text-collapse-text focus:border-collapse-accent focus:ring-1 focus:ring-collapse-accent outline-none transition-all" />
              </div>
            </div>
          </div>

          <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 border-b border-collapse-border pb-2">Appearance</h2>
            <div className="flex items-center justify-between p-4 bg-collapse-bg rounded-lg border border-collapse-border mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-collapse-surface rounded-md border border-collapse-border text-collapse-text">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Dark Mode</p>
                  <p className="text-xs text-collapse-muted">System is currently using dark theme</p>
                </div>
              </div>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-collapse-accent transition-colors">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
              </div>
            </div>
          </div>
          
          <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
             <h2 className="text-lg font-semibold mb-4 border-b border-collapse-border pb-2 text-collapse-risk">Danger Zone</h2>
             <p className="text-sm text-collapse-muted mb-4">
               Irreversible actions regarding your account and data.
             </p>
             <button className="px-4 py-2 bg-collapse-risk/10 text-collapse-risk border border-collapse-risk/20 rounded-lg text-sm font-medium hover:bg-collapse-risk/20 transition-colors">
               Delete Account
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ label, icon, active = false }: { label: string, icon: React.ReactNode, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-collapse-surface text-collapse-accent border-l-2 border-collapse-accent shadow-sm' : 'text-collapse-muted hover:text-collapse-text hover:bg-collapse-surface/50'}`}>
      {icon}
      {label}
    </button>
  );
}
