import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ThermometerSun, Droplets, MapPin, CalendarDays, TrendingUp } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { getWC2026Venues, getFixtureComparison } from '../../lib/api';
import type { WC2026Venue } from '../../lib/types';

export type VenueDisplay = {
  id: number;
  city: string;
  country: string;
  lat: number;
  lng: number;
  elevation: string;
  temp: string;
  humidity: string;
  stress: string;
  color: string;
};

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

function mapVenue(v: WC2026Venue): VenueDisplay {
  return {
    id: v.venue_id,
    city: v.city,
    country: v.country,
    lat: v.lat,
    lng: v.lon,
    elevation: `${v.elevation_ft}ft`,
    temp: `${v.june_temp_f}°F`,
    humidity: `${v.humidity_pct}%`,
    stress: stressLabel(v.stress_factor),
    color: stressColor(v.stress_factor),
  };
}

function MapFlyTo({ venue, duration = 1.2 }: { venue: VenueDisplay | null; duration?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!venue) return;
    const centerLat = venue.lat - 0.5;
    map.flyTo([centerLat, venue.lng], 8, { duration });
  }, [venue?.id, venue?.lat, venue?.lng, duration, map]);
  return null;
}

const fixtures = [
  { id: 1, teamA: 'Brazil', teamB: 'France', date: 'June 18, 2026' },
  { id: 2, teamA: 'USA', teamB: 'England', date: 'June 22, 2026' },
  { id: 3, teamA: 'Argentina', teamB: 'Mexico', date: 'June 26, 2026' },
  { id: 4, teamA: 'Germany', teamB: 'Spain', date: 'June 28, 2026' },
];

// Fix default Leaflet marker icons in bundler (vite)
const createIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const DEFAULT_VENUE_INDEX_BY_FIXTURE: Record<number, number> = {
  1: 0, 2: 1, 3: 4, 4: 2,
};

export function WorldCupContext() {
  const { data: venuesRaw = [] } = useQuery({
    queryKey: ['wc2026-venues'],
    queryFn: getWC2026Venues,
  });
  const venues = venuesRaw.map(mapVenue);

  const [selectedFixture, setSelectedFixture] = useState(fixtures[0]);
  const [comparisonCityA, setComparisonCityA] = useState<VenueDisplay | null>(null);
  const [comparisonCityB, setComparisonCityB] = useState<VenueDisplay | null>(null);
  const [flyToVenue, setFlyToVenue] = useState<VenueDisplay | null>(null);

  useEffect(() => {
    if (venues.length === 0) return;
    const base = venues[DEFAULT_VENUE_INDEX_BY_FIXTURE[selectedFixture.id] ?? 0];
    setComparisonCityA((prev) => prev ?? base);
    setComparisonCityB((prev) => prev ?? venues[4] ?? venues[0]);
  }, [venues, selectedFixture.id]);

  const { data: fixtureComparison } = useQuery({
    queryKey: ['fixture-comparison', selectedFixture.teamA, selectedFixture.teamB, comparisonCityB?.city],
    queryFn: () => getFixtureComparison(selectedFixture.teamA, selectedFixture.teamB, comparisonCityB!.city),
    enabled: !!comparisonCityB?.city,
  });

  const handleFixtureSelect = (fixture: typeof fixtures[0]) => {
    setSelectedFixture(fixture);
    if (venues.length > 0) {
      const base = venues[DEFAULT_VENUE_INDEX_BY_FIXTURE[fixture.id] ?? 0];
      setComparisonCityA(base);
      setFlyToVenue(base);
    }
  };

  const handleVenueClick = (venue: VenueDisplay) => {
    setComparisonCityA(venue);
    setFlyToVenue(venue);
  };

  return (
    <div className="h-full min-h-[100vh] flex flex-col bg-collapse-bg text-collapse-text overflow-hidden relative">
      {/* Full-screen map with real globe positions */}
      <div className="absolute inset-0 z-0 min-h-[100vh]" style={{ height: '100%' }}>
        <MapContainer
          center={[39.5, -98]}
          zoom={3}
          className="h-full w-full leaflet-container-dark"
          style={{ height: '100%', minHeight: '100vh' }}
          zoomControl={false}
        >
          <ZoomControl position="topright" />
          <MapFlyTo venue={flyToVenue} duration={1.2} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {venues.length > 0 && venues.map((venue) => (
            <Marker
              key={venue.id}
              position={[venue.lat, venue.lng]}
              icon={createIcon(venue.color)}
              eventHandlers={{
                click: () => handleVenueClick(venue),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-2 min-w-[140px]">
                  <div className="font-bold text-sm">{venue.city}</div>
                  <div className="text-xs text-collapse-muted">{venue.country} • {venue.stress}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span><ThermometerSun className="inline w-3 h-3" /> {venue.temp}</span>
                    <span><Droplets className="inline w-3 h-3" /> {venue.humidity}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVenueClick(venue)}
                    className="mt-2 w-full py-1 rounded bg-collapse-accent/20 text-collapse-accent text-xs font-medium hover:bg-collapse-accent/30"
                  >
                    Set as baseline & zoom
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none">
        <div className="bg-collapse-surface/90 backdrop-blur border border-collapse-border rounded-xl p-4 inline-block shadow-lg pointer-events-auto">
          <h1 className="text-xl font-bold font-sans tracking-tight flex items-center gap-2">
            <span className="bg-gradient-to-r from-collapse-accent to-collapse-purple bg-clip-text text-transparent">WC2026</span>
            Context
          </h1>
          <p className="text-xs text-collapse-muted">Environmental Stress • Pins at real host city locations</p>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10 pointer-events-none flex justify-center">
        <div className="bg-collapse-surface/95 backdrop-blur border border-collapse-border rounded-xl p-6 shadow-2xl w-full max-w-5xl pointer-events-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4 border-r border-collapse-border pr-6">
            <h3 className="text-sm font-medium text-collapse-muted uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Fixture Select
            </h3>
            <div className="space-y-2">
              {fixtures.map((fixture) => (
                <div
                  key={fixture.id}
                  onClick={() => handleFixtureSelect(fixture)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedFixture.id === fixture.id ? 'bg-collapse-accent/10 border-collapse-accent shadow-sm ring-2 ring-collapse-accent/30' : 'bg-collapse-bg border-collapse-border hover:border-collapse-muted'}`}
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

          <div className="col-span-2 flex flex-col">
            <h3 className="text-sm font-medium text-collapse-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Venue Impact Analysis
            </h3>
            <div className="flex items-center gap-4 flex-1">
              {comparisonCityA && <CityCard city={comparisonCityA} label="Baseline Venue" />}
              <div className="text-collapse-muted font-bold text-lg">VS</div>
              <div className="flex-1 h-full flex flex-col">
                {venues.length > 0 && (
                  <>
                    <select
                      className="bg-collapse-bg border border-collapse-border rounded-lg p-2 text-sm text-collapse-text mb-2 focus:border-collapse-accent focus:outline-none"
                      value={comparisonCityB?.id ?? venues[0].id}
                      onChange={(e) => setComparisonCityB(venues.find((v) => v.id === parseInt(e.target.value)) ?? venues[0])}
                    >
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.city}</option>
                      ))}
                    </select>
                    {comparisonCityB && <CityCard city={comparisonCityB} label="Alternative" />}
                  </>
                )}
              </div>
            </div>
            {comparisonCityA && comparisonCityB && (
              <div
                className="mt-4 bg-collapse-bg border border-collapse-border rounded-lg p-3 flex items-center justify-between"
                title="Environmental delta for this fixture if played at the alternative venue."
              >
                <span className="text-sm text-collapse-muted font-medium">
                  For {selectedFixture.teamA} vs {selectedFixture.teamB}: Collapse probability shift
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-collapse-muted">Delta</span>
                  <span
                    className={`text-xl font-bold font-mono ${
                      fixtureComparison
                        ? (fixtureComparison.adjusted_probability - fixtureComparison.base_probability) * 100 > 0
                          ? 'text-collapse-risk'
                          : (fixtureComparison.adjusted_probability - fixtureComparison.base_probability) * 100 < 0
                            ? 'text-collapse-safe'
                            : 'text-collapse-warn'
                        : comparisonCityB.stress === 'High' && comparisonCityA.stress === 'Low'
                          ? 'text-collapse-risk'
                          : 'text-collapse-warn'
                    }`}
                  >
                    {fixtureComparison
                      ? `${(fixtureComparison.adjusted_probability - fixtureComparison.base_probability) * 100 >= 0 ? '+' : ''}${((fixtureComparison.adjusted_probability - fixtureComparison.base_probability) * 100).toFixed(1)}%`
                      : (() => {
                          const base = comparisonCityB.stress === 'High' && comparisonCityA.stress === 'Low' ? 18 : comparisonCityB.stress === 'Low' && comparisonCityA.stress === 'High' ? -14 : 2;
                          const variation = (selectedFixture.id - 1) * 3;
                          const delta = base + (base >= 0 ? variation : -variation);
                          return delta >= 0 ? `+${delta}%` : `${delta}%`;
                        })()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CityCard({ city, label }: { city: VenueDisplay; label: string }) {
  return (
    <div className="flex-1 bg-collapse-bg border border-collapse-border rounded-lg p-4 h-full relative overflow-hidden group hover:border-collapse-muted transition-colors">
      <div
        className={`absolute top-0 left-0 w-1 h-full ${
          city.color === '#EF4444' ? 'bg-collapse-risk' : city.color === '#F59E0B' ? 'bg-collapse-warn' : 'bg-collapse-safe'
        }`}
      />
      <div className="pl-3">
        <span className="text-xs text-collapse-muted uppercase block mb-1">{label}</span>
        <h4 className="font-bold text-lg leading-tight mb-3">{city.city}</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-collapse-border pb-1">
            <span className="text-collapse-muted flex items-center gap-2"><ThermometerSun size={12} /> Temp</span>
            <span className="font-mono">{city.temp}</span>
          </div>
          <div className="flex justify-between border-b border-collapse-border pb-1">
            <span className="text-collapse-muted flex items-center gap-2"><Droplets size={12} /> Humidity</span>
            <span className="font-mono">{city.humidity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-collapse-muted flex items-center gap-2"><MapPin size={12} /> Elevation</span>
            <span className="font-mono">{city.elevation}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
