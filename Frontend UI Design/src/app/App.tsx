import { MemoryRouter, Routes, Route } from 'react-router';
import { Layout } from './layout/Layout';
import { MatchProvider } from './context/MatchContext';
import { Dashboard } from './pages/Dashboard';
import { WarRoom } from './pages/WarRoom';
import { CoachMode } from './pages/CoachMode';
import { InjurySim } from './pages/InjurySim';
import { WorldCupContext } from './pages/WorldCupContext';
import { NotFound } from './pages/NotFound';
import { Settings } from './pages/Settings';
import { CollapseOSTheme } from './pages/ThemeShowcase';
import '../styles/leaflet-overrides.css';

export default function App() {
  return (
    <MemoryRouter>
      <MatchProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="war-room" element={<WarRoom />} />
            <Route path="coach-mode" element={<CoachMode />} />
            <Route path="injury-sim" element={<InjurySim />} />
            <Route path="wc-2026" element={<WorldCupContext />} />
            <Route path="settings" element={<Settings />} />
            <Route path="theme" element={<CollapseOSTheme />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </MatchProvider>
    </MemoryRouter>
  );
}
