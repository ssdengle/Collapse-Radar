import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from 'react-leaflet';
import {
  ThermometerSun, Droplets, MapPin, CalendarDays, TrendingUp,
  X, AlertTriangle, Activity, Clock, ChevronRight,
} from 'lucide-react';
import { getWC2026Venues, getFixtureComparison } from '../../lib/api';
import type { WC2026Venue } from '../../lib/types';
import 'leaflet/dist/leaflet.css';

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

const fixtures = [
  // Mexico City
  { id:  1, teamA: 'Spain',        teamB: 'Morocco',    date: 'Jun 11, 2026', venueCity: 'Mexico City' },
  { id: 17, teamA: 'Ecuador',      teamB: 'Venezuela',  date: 'Jun 22, 2026', venueCity: 'Mexico City' },
  { id: 18, teamA: 'Qatar',        teamB: 'Senegal',    date: 'Jul 1,  2026', venueCity: 'Mexico City' },
  // Guadalajara
  { id:  2, teamA: 'Brazil',       teamB: 'France',     date: 'Jun 13, 2026', venueCity: 'Guadalajara' },
  { id: 19, teamA: 'Mexico',       teamB: 'Bolivia',    date: 'Jun 24, 2026', venueCity: 'Guadalajara' },
  // Monterrey
  { id:  3, teamA: 'Mexico',       teamB: 'Poland',     date: 'Jun 14, 2026', venueCity: 'Monterrey' },
  { id: 20, teamA: 'Colombia',     teamB: 'Paraguay',   date: 'Jun 25, 2026', venueCity: 'Monterrey' },
  // Dallas
  { id:  4, teamA: 'USA',          teamB: 'Mexico',     date: 'Jun 15, 2026', venueCity: 'Dallas' },
  { id: 21, teamA: 'Germany',      teamB: 'Chile',      date: 'Jun 26, 2026', venueCity: 'Dallas' },
  { id: 22, teamA: 'Brazil',       teamB: 'Costa Rica', date: 'Jul 3,  2026', venueCity: 'Dallas' },
  // Houston
  { id:  5, teamA: 'Portugal',     teamB: 'Uruguay',    date: 'Jun 16, 2026', venueCity: 'Houston' },
  { id: 23, teamA: 'Argentina',    teamB: 'Peru',       date: 'Jun 27, 2026', venueCity: 'Houston' },
  // Miami
  { id:  6, teamA: 'France',       teamB: 'Belgium',    date: 'Jun 17, 2026', venueCity: 'Miami' },
  { id: 24, teamA: 'Italy',        teamB: 'Croatia',    date: 'Jun 28, 2026', venueCity: 'Miami' },
  // Atlanta
  { id:  7, teamA: 'USA',          teamB: 'England',    date: 'Jun 18, 2026', venueCity: 'Atlanta' },
  { id: 25, teamA: 'Spain',        teamB: 'Japan',      date: 'Jun 29, 2026', venueCity: 'Atlanta' },
  // Philadelphia
  { id:  8, teamA: 'Germany',      teamB: 'Spain',      date: 'Jun 20, 2026', venueCity: 'Philadelphia' },
  { id: 26, teamA: 'Portugal',     teamB: 'Ghana',      date: 'Jun 30, 2026', venueCity: 'Philadelphia' },
  // New York/New Jersey
  { id:  9, teamA: 'Argentina',    teamB: 'Canada',     date: 'Jun 21, 2026', venueCity: 'New York/New Jersey' },
  { id: 27, teamA: 'England',      teamB: 'Nigeria',    date: 'Jul 1,  2026', venueCity: 'New York/New Jersey' },
  { id: 28, teamA: 'France',       teamB: 'Poland',     date: 'Jul 5,  2026', venueCity: 'New York/New Jersey' },
  // Boston
  { id: 10, teamA: 'Netherlands',  teamB: 'Senegal',    date: 'Jun 22, 2026', venueCity: 'Boston' },
  { id: 29, teamA: 'Denmark',      teamB: 'Serbia',     date: 'Jul 2,  2026', venueCity: 'Boston' },
  // Kansas City
  { id: 11, teamA: 'Argentina',    teamB: 'Chile',      date: 'Jun 23, 2026', venueCity: 'Kansas City' },
  { id: 30, teamA: 'USA',          teamB: 'Panama',     date: 'Jul 3,  2026', venueCity: 'Kansas City' },
  // Los Angeles
  { id: 12, teamA: 'Brazil',       teamB: 'Croatia',    date: 'Jun 24, 2026', venueCity: 'Los Angeles' },
  { id: 31, teamA: 'Germany',      teamB: 'Australia',  date: 'Jul 4,  2026', venueCity: 'Los Angeles' },
  { id: 32, teamA: 'Spain',        teamB: 'South Korea',date: 'Jul 8,  2026', venueCity: 'Los Angeles' },
  // San Francisco
  { id: 13, teamA: 'Germany',      teamB: 'Japan',      date: 'Jun 25, 2026', venueCity: 'San Francisco' },
  { id: 33, teamA: 'Mexico',       teamB: 'Canada',     date: 'Jul 5,  2026', venueCity: 'San Francisco' },
  // Seattle
  { id: 14, teamA: 'Italy',        teamB: 'Australia',  date: 'Jun 26, 2026', venueCity: 'Seattle' },
  { id: 34, teamA: 'Netherlands',  teamB: 'Ecuador',    date: 'Jul 6,  2026', venueCity: 'Seattle' },
  // Vancouver
  { id: 15, teamA: 'South Korea',  teamB: 'Nigeria',    date: 'Jun 27, 2026', venueCity: 'Vancouver' },
  { id: 35, teamA: 'Portugal',     teamB: 'Morocco',    date: 'Jul 7,  2026', venueCity: 'Vancouver' },
  // Toronto
  { id: 16, teamA: 'England',      teamB: 'Iran',       date: 'Jun 28, 2026', venueCity: 'Toronto' },
  { id: 36, teamA: 'Belgium',      teamB: 'Switzerland',date: 'Jul 8,  2026', venueCity: 'Toronto' },
];

type Fixture = typeof fixtures[number];

// Swaps tiles when theme changes — using key forces remount
function ThemedTileLayer({ isLight }: { isLight: boolean }) {
  return (
    <TileLayer
      key={isLight ? 'light' : 'dark'}
      url={isLight ? TILE_LIGHT : TILE_DARK}
      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
    />
  );
}

function FlyToVenue({ venue, venueId }: { venue: WC2026Venue | null; venueId: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (!venue || venueId == null) return;
    // Stop previous animation before starting a new one to avoid map jitter/flicker.
    map.stop();
    map.flyTo([venue.lat, venue.lon], 4.8, { duration: 0.9, easeLinearity: 0.25 });
  }, [venueId, venue, map]);
  return null;
}

// Reactively track html.light class changes
function useIsLightMode() {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains('light'),
  );
}

const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

export function WorldCupContext() {
  const isLight = useIsLightMode();
  const { data: venues = [] } = useQuery({
    queryKey: ['wc2026-venues'],
    queryFn: getWC2026Venues,
  });

  const [selectedFixture, setSelectedFixture] = useState<Fixture>(fixtures[0]);
  const [focusedVenueId, setFocusedVenueId] = useState<number | null>(null);
  const [flyVenueId, setFlyVenueId] = useState<number | null>(null);
  const [comparisonCityA, setComparisonCityA] = useState<WC2026Venue | null>(null);
  const [comparisonCityB, setComparisonCityB] = useState<WC2026Venue | null>(null);
  const [predictionOpen, setPredictionOpen] = useState(false);
  const focusedVenue = useMemo(
    () => venues.find(v => v.venue_id === focusedVenueId) ?? null,
    [venues, focusedVenueId],
  );

  // On venues load, seed comparison cities without flying
  useEffect(() => {
    if (venues.length > 0 && !comparisonCityA) {
      const matched = venues.find(v => v.city.toLowerCase() === fixtures[0].venueCity.toLowerCase());
      const cityA = matched ?? venues[0];
      setComparisonCityA(cityA);
      const alt = venues.find(v => v.venue_id !== cityA.venue_id) ?? venues[0];
      setComparisonCityB(alt);
    }
  }, [venues]);

  const baselineCity = comparisonCityA;
  const alternativeCity = comparisonCityB;

  const { data: comparisonA } = useQuery({
    queryKey: ['fixture-comparison', selectedFixture.teamA, selectedFixture.teamB, baselineCity?.city],
    queryFn: () => getFixtureComparison(selectedFixture.teamA, selectedFixture.teamB, baselineCity!.city),
    enabled: !!baselineCity?.city,
  });

  const { data: comparisonB } = useQuery({
    queryKey: ['fixture-comparison', selectedFixture.teamA, selectedFixture.teamB, alternativeCity?.city],
    queryFn: () => getFixtureComparison(selectedFixture.teamA, selectedFixture.teamB, alternativeCity!.city),
    enabled: !!alternativeCity?.city,
  });

  const probDelta = comparisonA && comparisonB
    ? ((comparisonB.adjusted_probability - comparisonA.adjusted_probability) * 100).toFixed(0)
    : null;
  const deltaNum = probDelta ? parseInt(probDelta, 10) : 0;

  function selectFixtureForPrediction(fixture: Fixture) {
    setSelectedFixture(fixture);
    const matched = venues.find(v => v.city.toLowerCase() === fixture.venueCity.toLowerCase());
    if (matched) {
      setFocusedVenueId(matched.venue_id);
      setFlyVenueId(matched.venue_id);
      setComparisonCityA(matched);
    }
    setPredictionOpen(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}
         className="bg-collapse-bg text-collapse-text">

      {/* ── MAP AREA ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <MapContainer
          center={[38, -98]}
          zoom={4}
          preferCanvas
          style={{ position: 'absolute', inset: 0, background: isLight ? '#E8EDF2' : '#0F172A' }}
          zoomControl={false}
          className="leaflet-container-dark"
        >
          <ThemedTileLayer isLight={isLight} />
          <ZoomControl position="bottomleft" />
          <FlyToVenue venue={focusedVenue} venueId={flyVenueId} />

          {venues.map((venue) => {
            const color = stressColor(venue.stress_factor);
            const matchesHere = fixtures.filter(f => f.venueCity.toLowerCase() === venue.city.toLowerCase());
            const isSelected = focusedVenue?.venue_id === venue.venue_id;

            return (
              <CircleMarker
                key={venue.venue_id}
                center={[venue.lat, venue.lon]}
                radius={9}
                pathOptions={{
                  color: isSelected ? '#ffffff' : color,
                  fillColor: color,
                  fillOpacity: isSelected ? 1 : 0.82,
                  weight: isSelected ? 2.5 : 1,
                  opacity: 1,
                }}
                eventHandlers={{
                  click: (e) => {
                    setFocusedVenueId(venue.venue_id);
                    // Clicking a pin should be stable: no fly animation.
                    setFlyVenueId(null);
                    setComparisonCityA(venue);
                    e.target.openPopup();
                  },
                }}
              >
                <Popup
                  className="custom-popup"
                  maxWidth={300}
                  autoPan
                  autoPanPaddingTopLeft={[20, 80]}
                  autoPanPaddingBottomRight={[20, 20]}
                >
                  <div className="p-3 min-w-[240px] text-slate-100">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full shrink-0 mt-1"
                           style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                      <div>
                        <h3 className="font-bold text-sm text-slate-100 leading-tight">{venue.city}</h3>
                        <span className="text-xs font-bold" style={{ color }}>{stressLabel(venue.stress_factor)} Stress</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {[
                        { icon: <ThermometerSun className="w-3 h-3 text-collapse-warn" />, val: `${venue.june_temp_f}°F`, lbl: 'Temp' },
                        { icon: <Droplets className="w-3 h-3 text-collapse-accent" />,     val: `${venue.humidity_pct}%`, lbl: 'Humid.' },
                        { icon: <MapPin className="w-3 h-3 text-collapse-muted" />,         val: `${venue.elevation_ft}ft`, lbl: 'Elev.' },
                      ].map(({ icon, val, lbl }) => (
                        <div key={lbl} className="bg-slate-100 rounded p-1.5 text-center border border-slate-300">
                          <div className="flex justify-center mb-0.5">{icon}</div>
                          <div className="font-mono font-bold text-xs text-slate-900">{val}</div>
                          <div className="text-[10px] text-slate-600">{lbl}</div>
                        </div>
                      ))}
                    </div>

                    {/* Matches — each with Analyse button */}
                    {matchesHere.length > 0 ? (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-medium">
                          Scheduled Matches
                        </p>
                        <div className="space-y-1.5">
                          {matchesHere.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => selectFixtureForPrediction(m)}
                              className="w-full flex items-center justify-between bg-slate-100 rounded px-2.5 py-2 border border-slate-300 hover:border-sky-400 hover:bg-sky-50 transition-all group cursor-pointer"
                            >
                              <div className="text-left">
                                <div className="text-xs font-semibold text-slate-900">
                                  {m.teamA} <span className="text-slate-500 font-normal">vs</span> {m.teamB}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">{m.date}</div>
                              </div>
                              <span className="text-[10px] text-sky-600 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                Analyse <ChevronRight size={10} />
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-collapse-muted italic">No featured matches</p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* WC2026 header overlay */}
        <div className="absolute top-4 left-4 z-[1000] bg-collapse-surface/90 backdrop-blur border border-collapse-border rounded-xl p-4 shadow-lg pointer-events-none">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-collapse-accent to-collapse-purple bg-clip-text text-transparent">WC2026</span>{' '}
            Context
          </h1>
          <p className="text-xs text-collapse-muted">Click a pin → select match → Analyse</p>
        </div>

        {/* Legend */}
        <div className="absolute top-4 right-4 z-[1000] bg-collapse-surface/90 backdrop-blur border border-collapse-border rounded-lg p-3 space-y-1.5 text-xs">
          <p className="text-collapse-muted font-medium uppercase tracking-wider text-[10px] mb-2">Env. Stress</p>
          {['#10B981|Low', '#F59E0B|Medium', '#EF4444|High / Critical'].map((entry) => {
            const [color, label] = entry.split('|');
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-collapse-text">{label}</span>
              </div>
            );
          })}
        </div>

        {/* ── PREDICTION OVERLAY PANEL (right side) ── */}
        {predictionOpen && (
          <div
            className="absolute top-0 right-0 bottom-0 z-[1100] w-[380px] bg-collapse-surface/98 backdrop-blur-md border-l border-collapse-border overflow-y-auto custom-scrollbar"
            style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.5)' }}
          >
            <div className="p-4 space-y-4">
              {/* Panel header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base">
                    {selectedFixture.teamA}{' '}
                    <span className="text-collapse-muted font-normal text-sm">vs</span>{' '}
                    {selectedFixture.teamB}
                  </h3>
                  <p className="text-xs text-collapse-muted flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> {selectedFixture.venueCity} · {selectedFixture.date}
                  </p>
                </div>
                <button
                  onClick={() => setPredictionOpen(false)}
                  className="text-collapse-muted hover:text-collapse-text transition-colors mt-0.5"
                >
                  <X size={16} />
                </button>
              </div>

              {!comparisonA ? (
                <div className="flex items-center justify-center py-8 text-collapse-muted text-sm">
                  Loading prediction…
                </div>
              ) : (
                <>
                  {/* Overall risk badge */}
                  <div className={`rounded-lg border p-3 flex items-center justify-between ${
                    comparisonA.adjusted_probability > 0.35
                      ? 'border-collapse-risk/30 bg-collapse-risk/5'
                      : comparisonA.adjusted_probability > 0.22
                      ? 'border-collapse-warn/30 bg-collapse-warn/5'
                      : 'border-collapse-safe/30 bg-collapse-safe/5'
                  }`}>
                    <div>
                      <p className="text-xs text-collapse-muted uppercase tracking-wider">Collapse Probability</p>
                      <p className={`text-3xl font-bold font-mono mt-0.5 ${
                        comparisonA.adjusted_probability > 0.35 ? 'text-collapse-risk'
                        : comparisonA.adjusted_probability > 0.22 ? 'text-collapse-warn'
                        : 'text-collapse-safe'
                      }`}>
                        {Math.round(comparisonA.adjusted_probability * 100)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-collapse-muted">Env. stress factor</p>
                      <p className="text-lg font-bold font-mono text-collapse-text">{comparisonA.env_stress.toFixed(2)}×</p>
                    </div>
                  </div>

                  {/* Historical team risk */}
                  <div className="space-y-2">
                    <p className="text-xs text-collapse-muted uppercase tracking-wider flex items-center gap-1">
                      <Activity size={11} /> Historical Risk by Team
                    </p>
                    {[
                      { team: selectedFixture.teamA, stats: comparisonA.stats_a },
                      { team: selectedFixture.teamB, stats: comparisonA.stats_b },
                    ].map(({ team, stats }) => (
                      <div key={team} className="bg-collapse-bg rounded-lg px-3 py-2.5 border border-collapse-border">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-semibold">{team}</span>
                          {stats.matches_analysed > 0 && (
                            <span className="text-[10px] text-collapse-muted">{stats.matches_analysed} matches</span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-collapse-muted">
                          <span>Avg risk <span className="font-mono font-bold text-collapse-text">{(stats.avg_risk * 100).toFixed(0)}%</span></span>
                          <span className="flex items-center gap-0.5"><Clock size={10} /> Peak at <span className="font-mono font-bold text-collapse-text ml-1">{stats.peak_minute}'</span></span>
                        </div>
                        {/* mini risk bar */}
                        <div className="mt-2 h-1.5 bg-collapse-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(stats.avg_risk * 250, 100)}%`,
                              backgroundColor: stats.avg_risk > 0.35 ? '#EF4444' : stats.avg_risk > 0.22 ? '#F59E0B' : '#10B981',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Collapse windows */}
                  <div className="space-y-2">
                    <p className="text-xs text-collapse-muted uppercase tracking-wider flex items-center gap-1">
                      <Clock size={11} /> Predicted Risk Windows
                    </p>
                    {comparisonA.collapse_windows.map((w) => (
                      <div key={w.window} className="bg-collapse-bg border border-collapse-border rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-mono font-bold text-collapse-text">{w.window}</span>
                          <p className="text-[10px] text-collapse-muted mt-0.5">{w.note}</p>
                        </div>
                        <span className={`text-sm font-bold font-mono ml-2 shrink-0 ${
                          w.risk > 0.45 ? 'text-collapse-risk' : w.risk > 0.28 ? 'text-collapse-warn' : 'text-collapse-safe'
                        }`}>
                          {Math.round(w.risk * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Risk drivers */}
                  <div className="space-y-2">
                    <p className="text-xs text-collapse-muted uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={11} /> Venue Risk Drivers
                    </p>
                    {comparisonA.risk_drivers.map((d) => (
                      <div key={d.factor} className={`rounded-lg border px-3 py-2 ${
                        d.severity === 'critical' ? 'border-collapse-risk/30 bg-collapse-risk/5'
                        : d.severity === 'medium'  ? 'border-collapse-warn/30 bg-collapse-warn/5'
                        : 'border-collapse-safe/30 bg-collapse-safe/5'
                      }`}>
                        <p className={`text-xs font-bold ${
                          d.severity === 'critical' ? 'text-collapse-risk'
                          : d.severity === 'medium'  ? 'text-collapse-warn'
                          : 'text-collapse-safe'
                        }`}>{d.factor}</p>
                        <p className="text-[11px] text-collapse-muted mt-0.5">{d.detail}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM STRIP ── */}
      <div style={{ flexShrink: 0 }} className="border-t border-collapse-border bg-collapse-surface/95">
        <div className="max-w-6xl mx-auto p-3 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Fixture list */}
          <div className="space-y-2 border-r border-collapse-border pr-4">
            <h3 className="text-xs font-medium text-collapse-muted uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5" /> Fixture Select
            </h3>
            <div className="grid grid-cols-1 gap-1 overflow-y-auto max-h-36 pr-1 custom-scrollbar">
              {fixtures.map((fixture) => (
                <div
                  key={fixture.id}
                  onClick={() => {
                    const matched = venues.find(v => v.city.toLowerCase() === fixture.venueCity.toLowerCase());
                    if (matched) {
                      setFocusedVenueId(matched.venue_id);
                      setFlyVenueId(matched.venue_id);
                      setComparisonCityA(matched);
                    }
                    setSelectedFixture(fixture);
                  }}
                  className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${
                    selectedFixture.id === fixture.id
                      ? 'bg-collapse-accent/10 border-collapse-accent'
                      : 'bg-collapse-bg border-collapse-border hover:border-collapse-muted'
                  }`}
                >
                  <div>
                    <div className="flex gap-1 font-bold text-xs">
                      <span>{fixture.teamA}</span>
                      <span className="text-collapse-muted font-normal">vs</span>
                      <span>{fixture.teamB}</span>
                    </div>
                    <div className="text-[10px] text-collapse-muted flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" /> {fixture.venueCity} · {fixture.date}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); selectFixtureForPrediction(fixture); }}
                    className="text-[10px] text-collapse-accent font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                  >
                    Analyse <ChevronRight size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Venue comparison */}
          <div className="col-span-2 flex flex-col gap-2">
            <h3 className="text-xs font-medium text-collapse-muted uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Venue Comparison
            </h3>
            <div className="flex items-stretch gap-3 flex-1">
              <CityCard venue={baselineCity} label="Baseline" />
              <div className="flex items-center text-collapse-muted font-bold text-sm">VS</div>
              <div className="flex-1 flex flex-col gap-1.5">
                <select
                  className="bg-collapse-bg border border-collapse-border rounded-lg px-3 py-1.5 text-xs text-collapse-text focus:border-collapse-accent focus:outline-none"
                  value={alternativeCity?.venue_id ?? ''}
                  onChange={(e) => {
                    const v = venues.find(x => x.venue_id === parseInt(e.target.value, 10));
                    if (v) setComparisonCityB(v);
                  }}
                >
                  {venues.map((v) => (
                    <option key={v.venue_id} value={v.venue_id}>{v.city}</option>
                  ))}
                </select>
                <CityCard venue={alternativeCity} label="Alternative" />
              </div>
            </div>
            <div className="bg-collapse-bg border border-collapse-border rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-collapse-muted">Collapse Probability Shift (env. delta)</span>
              <span className={`text-lg font-bold font-mono ${deltaNum > 0 ? 'text-collapse-risk' : deltaNum < 0 ? 'text-collapse-safe' : 'text-collapse-warn'}`}>
                {probDelta != null ? (deltaNum > 0 ? `+${probDelta}%` : `${probDelta}%`) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CityCard({ venue, label }: { venue: WC2026Venue | null; label: string }) {
  if (!venue) return (
    <div className="flex-1 bg-collapse-bg border border-collapse-border rounded-lg p-2 flex items-center justify-center text-collapse-muted text-xs">
      {label} — loading…
    </div>
  );
  const color = stressColor(venue.stress_factor);
  const barClass = color === '#EF4444' ? 'bg-collapse-risk' : color === '#F59E0B' ? 'bg-collapse-warn' : 'bg-collapse-safe';
  return (
    <div className="flex-1 bg-collapse-bg border border-collapse-border rounded-lg p-2.5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${barClass}`} />
      <div className="pl-2.5">
        <span className="text-[10px] text-collapse-muted uppercase block">{label}</span>
        <h4 className="font-bold text-sm leading-tight mb-1.5">{venue.city}</h4>
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span className="text-collapse-muted flex items-center gap-1"><ThermometerSun size={9} />Temp</span>
            <span className="font-mono">{venue.june_temp_f}°F</span>
          </div>
          <div className="flex justify-between">
            <span className="text-collapse-muted flex items-center gap-1"><Droplets size={9} />Humid.</span>
            <span className="font-mono">{venue.humidity_pct}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-collapse-muted flex items-center gap-1"><MapPin size={9} />Elev.</span>
            <span className="font-mono">{venue.elevation_ft}ft</span>
          </div>
        </div>
      </div>
    </div>
  );
}
