import React, { useEffect, useState } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { Layout } from './layout/Layout';
import { MatchProvider } from './context/MatchContext';
import { Dashboard } from './pages/Dashboard';
import { WarRoom } from './pages/WarRoom';
import { CoachView } from './pages/CoachView';
import { CoachLineup } from './pages/CoachLineup';
import { PlayerPortal } from './pages/PlayerPortal';
import { WorldCupContext } from './pages/WorldCupContext';
import { NotFound } from './pages/NotFound';
import { CollapseOSTheme } from './pages/ThemeShowcase';
import '../styles/leaflet-overrides.css';

type ThemeMode = 'dark' | 'light';
const THEME_KEY = 'collapseos_theme';
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  localStorage.setItem(THEME_KEY, mode);
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-white text-black dark:bg-[#050A14] dark:text-white flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-collapse-risk/40 rounded-xl p-8 space-y-4">
            <h1 className="text-xl font-bold text-collapse-risk">App Error</h1>
            <pre className="text-sm text-collapse-muted whitespace-pre-wrap break-all bg-collapse-bg rounded p-4 border border-collapse-border">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-collapse-accent text-white rounded-lg text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      const ctrl = new AbortController();
      const timeout = window.setTimeout(() => ctrl.abort(), 4000);
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
        if (mounted) setBackendConnected(res.status === 200);
      } catch {
        if (mounted) setBackendConnected(false);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    checkHealth();
    const id = window.setInterval(checkHealth, 10000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <ErrorBoundary>
      <MemoryRouter>
        <MatchProvider>
          <Routes>
            <Route
              path="/"
              element={
                <Layout
                  theme={theme}
                  onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
                  backendConnected={backendConnected}
                />
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="war-room" element={<WarRoom />} />
              <Route path="coach-view" element={<CoachView />} />
              <Route path="coach-lineup" element={<CoachLineup />} />
              <Route path="player-portal" element={<PlayerPortal />} />
              <Route path="wc-2026" element={<WorldCupContext />} />
              <Route path="theme" element={<CollapseOSTheme />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </MatchProvider>
      </MemoryRouter>
    </ErrorBoundary>
  );
}
