import React from 'react';
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
import { Settings } from './pages/Settings';
import { CollapseOSTheme } from './pages/ThemeShowcase';
import '../styles/leaflet-overrides.css';

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
        <div className="min-h-screen bg-collapse-bg text-collapse-text flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-collapse-surface border border-collapse-risk/40 rounded-xl p-8 space-y-4">
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
  return (
    <ErrorBoundary>
      <MemoryRouter>
        <MatchProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="war-room" element={<WarRoom />} />
              <Route path="coach-view" element={<CoachView />} />
              <Route path="coach-lineup" element={<CoachLineup />} />
              <Route path="player-portal" element={<PlayerPortal />} />
              <Route path="wc-2026" element={<WorldCupContext />} />
              <Route path="settings" element={<Settings />} />
              <Route path="theme" element={<CollapseOSTheme />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </MatchProvider>
      </MemoryRouter>
    </ErrorBoundary>
  );
}
