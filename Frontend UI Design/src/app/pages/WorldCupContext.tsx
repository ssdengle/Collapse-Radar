import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ThermometerSun, Droplets, MapPin, CalendarDays, TrendingUp } from 'lucide-react';
import { getWC2026Venues, getFixtureComparison } from '../../lib/api';
import type { WC2026Venue } from '../../lib/types';

function stressColor(factor: number): string {
  if (factor >= 1.15) return '#EF4444';
  if (factor >= 1.05) return '#F59E0B';
  return '#10B981';
}

function stressLabel(factor: number): string {
  if (factor >= 1.2) return 'Critical';
  if (factor >= 1.15) return 'High';
  if (factor >= 1.05) return 'Medium';
  return 'Low';
}

function venueToImagePosition(lat: number, lon: number): { top: string; left: string } {
  const absLon = Math.abs(lon);
  const top = ((55 - lat) / 35) * 60 + 20;
  const left = ((absLon - 65) / 65) * 80 + 10;
  return { top: `${Math.max(0, Math.min(100, top))}%`, left: `${Math.max(0, Math.min(100, left))}%` };
}

const fixtures = [
  { id: 1, teamA: 'Brazil', teamB: 'France', date: 'June 18, 2026' },
  { id: 2, teamA: 'USA', teamB: 'England', date: 'June 22, 2026' },
  { id: 3, teamA: 'Argentina', teamB: 'Mexico', date: 'June 26, 2026' },
  { id: 4, teamA: 'Germany', teamB: 'Spain', date: 'June 28, 2026' },
];

export function WorldCupContext() {
  const { data: venues = [], isLoading: venuesLoading } = useQuery({
    queryKey: ['wc2026-venues'],
    queryFn: getWC2026Venues,
  });

  const [selectedFixture, setSelectedFixture] = useState(fixtures[0]);
  const [comparisonCityA, setComparisonCityA] = useState<WC2026Venue | null>(null);
  const [comparisonCityB, setComparisonCityB] = useState<WC2026Venue | null>(null);

  const baselineCity = comparisonCityA ?? venues[0] ?? null;
  const alternativeCity = comparisonCityB ?? venues[4] ?? venues[0] ?? null;

  const { data: comparisonA } = useQuery({
    queryKey: ['fixture-comparison', selectedFixture.teamA, selectedFixture.teamB, baselineCity?.city],
    queryFn: () =>
      getFixtureComparison(selectedFixture.teamA, selectedFixture.teamB, baselineCity!.city),
    enabled: !!baselineCity?.city,
  });

  const { data: comparisonB } = useQuery({
    queryKey: ['fixture-comparison', selectedFixture.teamA, selectedFixture.teamB, alternativeCity?.city],
    queryFn: () =>
      getFixtureComparison(selectedFixture.teamA, selectedFixture.teamB, alternativeCity!.city),
    enabled: !!alternativeCity?.city,
  });

  const probDelta =
    comparisonA && comparisonB
      ? ((comparisonB.adjusted_probability - comparisonA.adjusted_probability) * 100).toFixed(0)
      : null;
  const deltaNum = probDelta ? parseInt(probDelta, 10) : 0;

  return (
    <div className="h-full flex flex-col bg-collapse-bg text-collapse-text overflow-hidden relative">
      {/* Map Container - Full Width/Height - Simplified with static image background */}
      <div className="absolute inset-0 z-0 bg-collapse-bg">
        <div 
          className="w-full h-full bg-cover bg-center opacity-40 brightness-50"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1770723965051-249655a8aedb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWFwJTIwbm9ydGglMjBhbWVyaWNhJTIwc2F0ZWxsaXRlJTIwdmlld3xlbnwxfHx8fDE3NzE2NTMxODR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)' }}
        ></div>
        
        {/* Custom Marker Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {venues.map((venue) => {
            const pos = venueToImagePosition(venue.lat, venue.lon);
            const color = stressColor(venue.stress_factor);
            return (
              <div
                key={venue.venue_id}
                className="absolute w-3 h-3 rounded-full border-2 border-white shadow-lg cursor-pointer transform hover:scale-150 transition-transform pointer-events-auto"
                style={{
                  top: pos.top,
                  left: pos.left,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}`,
                }}
                onClick={() => setComparisonCityA(venue)}
                title={`${venue.city} (${stressLabel(venue.stress_factor)})`}
              >
                <span className="sr-only">{venue.city}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overlay: Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none">
        <div className="bg-collapse-surface/90 backdrop-blur border border-collapse-border rounded-xl p-4 inline-block shadow-lg pointer-events-auto">
          <h1 className="text-xl font-bold font-sans tracking-tight flex items-center gap-2">
            <span className="bg-gradient-to-r from-collapse-accent to-collapse-purple bg-clip-text text-transparent">WC2026</span>
            Context
          </h1>
          <p className="text-xs text-collapse-muted">Environmental Stress Projection Model</p>
        </div>
      </div>

      {/* Overlay: Bottom Panel (Fixture Selector & Comparison) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10 pointer-events-none flex justify-center">
        <div className="bg-collapse-surface/95 backdrop-blur border border-collapse-border rounded-xl p-6 shadow-2xl w-full max-w-5xl pointer-events-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Fixture Selector */}
          <div className="space-y-4 border-r border-collapse-border pr-6">
            <h3 className="text-sm font-medium text-collapse-muted uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Fixture Select
            </h3>
            <div className="space-y-2">
              {fixtures.map((fixture) => (
                <div 
                  key={fixture.id}
                  onClick={() => setSelectedFixture(fixture)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedFixture.id === fixture.id ? 'bg-collapse-accent/10 border-collapse-accent shadow-sm' : 'bg-collapse-bg border-collapse-border hover:border-collapse-muted'}`}
                >
                  <div className="flex justify-between font-bold text-sm mb-1">
                    <span>{fixture.teamA}</span>
                    <span className="text-collapse-muted font-normal">vs</span>
                    <span>{fixture.teamB}</span>
                  </div>
                  <div className="text-xs text-collapse-muted">{fixture.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison View */}
          <div className="col-span-2 flex flex-col">
            <h3 className="text-sm font-medium text-collapse-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Venue Impact Analysis
            </h3>
            
            <div className="flex items-center gap-4 flex-1">
              <CityCard venue={baselineCity} label="Baseline Venue" />

              <div className="text-collapse-muted font-bold text-lg">VS</div>

              <div className="flex-1 h-full flex flex-col">
                <select
                  className="bg-collapse-bg border border-collapse-border rounded-lg p-2 text-sm text-collapse-text mb-2 focus:border-collapse-accent focus:outline-none"
                  value={alternativeCity?.venue_id ?? ''}
                  onChange={(e) => {
                    const v = venues.find((x) => x.venue_id === parseInt(e.target.value, 10));
                    if (v) setComparisonCityB(v);
                  }}
                >
                  {venues.map((v) => (
                    <option key={v.venue_id} value={v.venue_id}>
                      {v.city}
                    </option>
                  ))}
                </select>
                <CityCard venue={alternativeCity} label="Alternative" />
              </div>
            </div>

            <div className="mt-4 bg-collapse-bg border border-collapse-border rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-collapse-muted font-medium">Predicted Collapse Probability Shift</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-collapse-muted">Environmental Delta Only</span>
                <span
                  className={`text-xl font-bold font-mono ${
                    deltaNum > 0 ? 'text-collapse-risk' : deltaNum < 0 ? 'text-collapse-safe' : 'text-collapse-warn'
                  }`}
                >
                  {probDelta != null ? (deltaNum > 0 ? `+${probDelta}%` : `${probDelta}%`) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CityCard({ venue, label }: { venue: WC2026Venue | null; label: string }) {
  if (!venue) return <div className="flex-1 bg-collapse-bg border border-collapse-border rounded-lg p-4 flex items-center justify-center text-collapse-muted text-sm">{label} — loading…</div>;
  const color = stressColor(venue.stress_factor);
  const barClass = color === '#EF4444' ? 'bg-collapse-risk' : color === '#F59E0B' ? 'bg-collapse-warn' : 'bg-collapse-safe';
  return (
    <div className="flex-1 bg-collapse-bg border border-collapse-border rounded-lg p-4 h-full relative overflow-hidden group hover:border-collapse-muted transition-colors">
      <div className={`absolute top-0 left-0 w-1 h-full ${barClass}`} />
      <div className="pl-3">
        <span className="text-xs text-collapse-muted uppercase block mb-1">{label}</span>
        <h4 className="font-bold text-lg leading-tight mb-3">{venue.city}</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-collapse-border pb-1">
            <span className="text-collapse-muted flex items-center gap-2"><ThermometerSun size={12} /> Temp</span>
            <span className="font-mono">{venue.june_temp_f}°F</span>
          </div>
          <div className="flex justify-between border-b border-collapse-border pb-1">
            <span className="text-collapse-muted flex items-center gap-2"><Droplets size={12} /> Humidity</span>
            <span className="font-mono">{venue.humidity_pct}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-collapse-muted flex items-center gap-2"><MapPin size={12} /> Elevation</span>
            <span className="font-mono">{venue.elevation_ft} ft</span>
          </div>
        </div>
      </div>
    </div>
  );
}
