import { useState } from 'react';
import { CloudRain, ThermometerSun, Wind, Droplets, MapPin, CalendarDays, TrendingUp } from 'lucide-react';

const venues = [
  { id: 1, city: 'Mexico City', country: 'Mexico', lat: 70, lng: 30, elevation: '2,240m', temp: '26°C', humidity: '45%', stress: 'High', color: '#EF4444' },
  { id: 2, city: 'New York/NJ', country: 'USA', lat: 38, lng: 75, elevation: '10m', temp: '32°C', humidity: '85%', stress: 'Medium', color: '#F59E0B' },
  { id: 3, city: 'Los Angeles', country: 'USA', lat: 45, lng: 15, elevation: '70m', temp: '29°C', humidity: '55%', stress: 'Low', color: '#10B981' },
  { id: 4, city: 'Toronto', country: 'Canada', lat: 35, lng: 70, elevation: '76m', temp: '25°C', humidity: '60%', stress: 'Low', color: '#10B981' },
  { id: 5, city: 'Miami', country: 'USA', lat: 60, lng: 78, elevation: '2m', temp: '34°C', humidity: '92%', stress: 'Critical', color: '#EF4444' },
  { id: 6, city: 'Dallas', country: 'USA', lat: 55, lng: 45, elevation: '130m', temp: '36°C', humidity: '40%', stress: 'Medium', color: '#F59E0B' },
  { id: 7, city: 'Atlanta', country: 'USA', lat: 50, lng: 65, elevation: '300m', temp: '31°C', humidity: '75%', stress: 'Medium', color: '#F59E0B' },
  { id: 8, city: 'Kansas City', country: 'USA', lat: 40, lng: 50, elevation: '270m', temp: '33°C', humidity: '65%', stress: 'Medium', color: '#F59E0B' },
  { id: 9, city: 'Houston', country: 'USA', lat: 60, lng: 48, elevation: '15m', temp: '35°C', humidity: '88%', stress: 'High', color: '#EF4444' },
  { id: 10, city: 'San Francisco', country: 'USA', lat: 42, lng: 12, elevation: '20m', temp: '22°C', humidity: '50%', stress: 'Low', color: '#10B981' },
  { id: 11, city: 'Seattle', country: 'USA', lat: 25, lng: 15, elevation: '5m', temp: '24°C', humidity: '55%', stress: 'Low', color: '#10B981' },
  { id: 12, city: 'Vancouver', country: 'Canada', lat: 20, lng: 12, elevation: '10m', temp: '23°C', humidity: '58%', stress: 'Low', color: '#10B981' },
  { id: 13, city: 'Guadalajara', country: 'Mexico', lat: 72, lng: 25, elevation: '1,566m', temp: '28°C', humidity: '40%', stress: 'Medium', color: '#F59E0B' },
  { id: 14, city: 'Monterrey', country: 'Mexico', lat: 65, lng: 35, elevation: '540m', temp: '35°C', humidity: '35%', stress: 'High', color: '#EF4444' },
  { id: 15, city: 'Philadelphia', country: 'USA', lat: 37, lng: 76, elevation: '12m', temp: '30°C', humidity: '70%', stress: 'Medium', color: '#F59E0B' },
  { id: 16, city: 'Boston', country: 'USA', lat: 35, lng: 80, elevation: '45m', temp: '27°C', humidity: '65%', stress: 'Low', color: '#10B981' },
];

const fixtures = [
  { id: 1, teamA: 'Brazil', teamB: 'France', date: 'June 18, 2026' },
  { id: 2, teamA: 'USA', teamB: 'England', date: 'June 22, 2026' },
  { id: 3, teamA: 'Argentina', teamB: 'Mexico', date: 'June 26, 2026' },
  { id: 4, teamA: 'Germany', teamB: 'Spain', date: 'June 28, 2026' },
];

export function WorldCupContext() {
  const [selectedFixture, setSelectedFixture] = useState(fixtures[0]);
  const [comparisonCityA, setComparisonCityA] = useState(venues[0]); // Mexico City
  const [comparisonCityB, setComparisonCityB] = useState(venues[4]); // Miami

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
          {venues.map((venue) => (
             <div 
               key={venue.id}
               className="absolute w-3 h-3 rounded-full border-2 border-white shadow-lg cursor-pointer transform hover:scale-150 transition-transform pointer-events-auto"
               style={{ 
                 top: `${venue.lat}%`, 
                 left: `${venue.lng}%`, 
                 backgroundColor: venue.color,
                 boxShadow: `0 0 10px ${venue.color}`
               }}
               onClick={() => setComparisonCityA(venue)}
               title={`${venue.city} (${venue.stress})`}
             >
               <span className="sr-only">{venue.city}</span>
             </div>
          ))}
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
              {/* City A Card */}
              <CityCard city={comparisonCityA} label="Baseline Venue" />

              <div className="text-collapse-muted font-bold text-lg">VS</div>

              {/* City B Card (Dropdown for selection) */}
              <div className="flex-1 h-full flex flex-col">
                <select 
                  className="bg-collapse-bg border border-collapse-border rounded-lg p-2 text-sm text-collapse-text mb-2 focus:border-collapse-accent focus:outline-none"
                  value={comparisonCityB.id}
                  onChange={(e) => setComparisonCityB(venues.find(v => v.id === parseInt(e.target.value)) || venues[0])}
                >
                  {venues.map(v => <option key={v.id} value={v.id}>{v.city}</option>)}
                </select>
                <CityCard city={comparisonCityB} label="Alternative" />
              </div>
            </div>

            <div className="mt-4 bg-collapse-bg border border-collapse-border rounded-lg p-3 flex items-center justify-between">
               <span className="text-sm text-collapse-muted font-medium">Predicted Collapse Probability Shift</span>
               <div className="flex items-center gap-2">
                 <span className="text-xs text-collapse-muted">Environmental Delta Only</span>
                 <span className={`text-xl font-bold font-mono ${
                   (comparisonCityB.stress === 'High' && comparisonCityA.stress === 'Low') ? 'text-collapse-risk' :
                   (comparisonCityB.stress === 'Low' && comparisonCityA.stress === 'High') ? 'text-collapse-safe' : 'text-collapse-warn'
                 }`}>
                   {(comparisonCityB.stress === 'High' && comparisonCityA.stress === 'Low') ? '+18%' :
                    (comparisonCityB.stress === 'Low' && comparisonCityA.stress === 'High') ? '-14%' : '+2%'}
                 </span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CityCard({ city, label }: { city: any, label: string }) {
  return (
    <div className="flex-1 bg-collapse-bg border border-collapse-border rounded-lg p-4 h-full relative overflow-hidden group hover:border-collapse-muted transition-colors">
      <div className={`absolute top-0 left-0 w-1 h-full ${city.color === '#EF4444' ? 'bg-collapse-risk' : city.color === '#F59E0B' ? 'bg-collapse-warn' : 'bg-collapse-safe'}`} />
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
