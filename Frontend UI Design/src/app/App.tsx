import { MemoryRouter, Routes, Route } from 'react-router';
import { Layout } from './layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { WarRoom } from './pages/WarRoom';
import { CoachMode } from './pages/CoachMode';
import { InjurySim } from './pages/InjurySim';
import { WorldCupContext } from './pages/WorldCupContext';
import { NotFound } from './pages/NotFound';
import '../styles/leaflet-overrides.css';

export default function App() {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="war-room" element={<WarRoom />} />
          <Route path="coach-mode" element={<CoachMode />} />
          <Route path="injury-sim" element={<InjurySim />} />
          <Route path="wc-2026" element={<WorldCupContext />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
