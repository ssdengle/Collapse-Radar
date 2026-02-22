import { useState, useEffect } from "react";
import { Moon, Sun, Database } from "lucide-react";

function getInitialDark(): boolean {
  const stored = localStorage.getItem("collapse-theme");
  if (stored) return stored === "dark";
  return true; // default dark
}

export function Settings() {
  const [isDark, setIsDark] = useState(getInitialDark);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("collapse-theme", "dark");
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("collapse-theme", "light");
    }
  }, [isDark]);

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
            {isDark ? <Moon className="w-4 h-4 text-collapse-muted" /> : <Sun className="w-4 h-4 text-collapse-warn" />}
            Appearance
          </h2>
          <div className="flex items-center justify-between p-4 bg-collapse-bg rounded-lg border border-collapse-border">
            <div>
              <p className="font-medium text-sm">Dark Mode</p>
              <p className="text-xs text-collapse-muted mt-0.5">
                {isDark ? "Using dark theme" : "Using light theme"} — preference saved automatically
              </p>
            </div>
            <button
              onClick={() => setIsDark((d) => !d)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                isDark ? "bg-collapse-accent" : "bg-collapse-border"
              }`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  isDark ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Backend */}
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
              <span className="text-xs bg-collapse-safe/10 text-collapse-safe border border-collapse-safe/20 px-2 py-0.5 rounded font-mono">
                connected
              </span>
            </div>
            <p className="text-xs text-collapse-muted">
              Set <code className="bg-collapse-bg px-1 rounded">VITE_API_URL</code> in{" "}
              <code className="bg-collapse-bg px-1 rounded">Frontend UI Design/.env</code> to change the backend URL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
