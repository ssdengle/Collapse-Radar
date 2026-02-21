import { Bell, Moon, Database, RefreshCw } from "lucide-react";

export function Settings() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 text-collapse-text">
      <div>
        <h1 className="text-3xl font-bold font-sans tracking-tight">Settings</h1>
        <p className="text-collapse-muted mt-2">Analyst preferences and system configuration.</p>
      </div>

      <div className="space-y-5">
        {/* Appearance */}
        <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4 border-b border-collapse-border pb-3 flex items-center gap-2">
            <Moon className="w-4 h-4 text-collapse-muted" /> Appearance
          </h2>
          <div className="flex items-center justify-between p-4 bg-collapse-bg rounded-lg border border-collapse-border">
            <div>
              <p className="font-medium text-sm">Dark Mode</p>
              <p className="text-xs text-collapse-muted mt-0.5">CollapseOS uses dark theme by default</p>
            </div>
            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-collapse-accent">
              <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white" />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4 border-b border-collapse-border pb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-collapse-muted" /> Alert Thresholds
          </h2>
          <div className="space-y-4">
            <SettingRow label="High-risk threshold" description="Alert when collapse probability exceeds this value" defaultValue="65" unit="%" />
            <SettingRow label="CUSUM sensitivity" description="Minutes of sustained elevated risk before flagging" defaultValue="3" unit="min" />
          </div>
        </div>

        {/* API */}
        <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4 border-b border-collapse-border pb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-collapse-muted" /> Backend
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-collapse-bg rounded-lg border border-collapse-border">
              <div>
                <p className="text-sm font-medium">API endpoint</p>
                <p className="text-xs text-collapse-muted font-mono mt-0.5">
                  {import.meta.env.VITE_API_URL || 'http://localhost:8000'}
                </p>
              </div>
              <span className="text-xs bg-collapse-safe/10 text-collapse-safe border border-collapse-safe/20 px-2 py-0.5 rounded font-mono">connected</span>
            </div>
            <p className="text-xs text-collapse-muted">
              Set <code className="bg-collapse-bg px-1 rounded">VITE_API_URL</code> in <code className="bg-collapse-bg px-1 rounded">Frontend UI Design/.env</code> to change the backend URL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, description, defaultValue, unit }: { label: string; description: string; defaultValue: string; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-collapse-bg rounded-lg border border-collapse-border">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-collapse-muted mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          defaultValue={defaultValue}
          className="w-16 bg-collapse-surface border border-collapse-border rounded px-2 py-1 text-sm text-right text-collapse-text font-mono focus:border-collapse-accent focus:outline-none"
        />
        {unit && <span className="text-xs text-collapse-muted font-mono">{unit}</span>}
      </div>
    </div>
  );
}
