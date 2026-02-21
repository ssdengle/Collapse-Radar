import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Plot from 'react-plotly.js';
import { ShieldAlert, Timer } from 'lucide-react';
import { motion } from 'motion/react';
import { getTimeline, getGoals, getWindow } from '../../lib/api';
import type { MatchWindow } from '../../lib/types';
import { useMatch } from '../context/MatchContext';
import { Skeleton } from '../components/ui/skeleton';

function formatFeatureName(key: string): string {
  const names: Record<string, string> = {
    pass_accuracy_slope: 'Pass Accuracy Drop',
    turnover_per_min: 'Turnover Rate',
    turnover_burstiness: 'Turnover Clustering',
    defensive_actions_per_min: 'Defensive Overload',
    final_third_entries_per_min: 'Final Third Pressure',
    shots_conceded_per_min: 'Shots Conceded',
    tempo_variance: 'Tempo Chaos',
    territory_tilt: 'Territory Lost',
    env_stress_multiplier: 'Environmental Stress',
  };
  return names[key] ?? key;
}

function getFeatureValue(w: MatchWindow, key: string): number {
  const v = w.features[key as keyof typeof w.features];
  if (v == null) return 0;
  return Math.round(Math.min(100, Math.max(0, v * 100)));
}

export function WarRoom() {
  const { matchId, team, match } = useMatch();
  const [currentMinute, setCurrentMinute] = useState(65);
  const [debouncedMinute, setDebouncedMinute] = useState(65);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMinute(currentMinute), 300);
    return () => clearTimeout(t);
  }, [currentMinute]);

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', matchId, team],
    queryFn: () => getTimeline(matchId, team),
    enabled: !!matchId && !!team,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals', matchId],
    queryFn: () => getGoals(matchId),
    enabled: !!matchId,
  });

  const { data: windowData } = useQuery({
    queryKey: ['window', matchId, debouncedMinute, team],
    queryFn: () => getWindow(matchId, debouncedMinute, team),
    enabled: !!matchId && !!team && timeline.length > 0,
  });

  const cusumMinutes = useMemo(
    () => timeline.filter((t) => t.cusum_flag).map((t) => t.minute),
    [timeline]
  );

  const currentRisk = useMemo(() => {
    const point = timeline.find((t) => t.minute === currentMinute);
    return point?.probability ?? timeline[currentMinute]?.probability ?? 0;
  }, [timeline, currentMinute]);

  const riskDrivers = useMemo(() => {
    if (!windowData) return [];
    const drivers = [windowData.driver_1, windowData.driver_2, windowData.driver_3].filter(Boolean);
    const colors = ['#EF4444', '#F59E0B', '#EAB308'];
    return drivers.map((key, i) => ({
      name: formatFeatureName(key),
      value: getFeatureValue(windowData, key),
      color: colors[i] ?? '#94a3b8',
    }));
  }, [windowData]);

  const maxMinute = timeline.length > 0 ? Math.max(95, ...timeline.map((t) => t.minute)) : 95;

  const traces: any[] = [
    {
      x: timeline.map((t) => t.minute),
      y: timeline.map((t) => t.probability * 100),
      type: 'scatter',
      mode: 'lines',
      name: 'Collapse Risk %',
      line: { color: '#0EA5E9', width: 2.5 },
      fill: 'tozeroy',
      fillcolor: 'rgba(14,165,233,0.08)',
      hoverinfo: 'y+x',
    },
    {
      x: [currentMinute, currentMinute],
      y: [0, 100],
      type: 'scatter',
      mode: 'lines',
      name: 'Current Time',
      line: { color: '#E2E8F0', width: 2, dash: 'solid' },
      hoverinfo: 'none',
      showlegend: false,
    },
  ];

  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#E2E8F0', family: 'Inter' },
    xaxis: {
      title: 'Match Minute',
      range: [0, maxMinute],
      gridcolor: '#334155',
      zeroline: false,
      tickfont: { color: '#94a3b8' },
      fixedrange: true,
    },
    yaxis: {
      title: 'Collapse Risk %',
      range: [0, 100],
      gridcolor: '#334155',
      tickfont: { color: '#94a3b8' },
      fixedrange: true,
    },
    shapes: [
      ...goals.map((g) => ({
        type: 'line',
        x0: g.minute,
        x1: g.minute,
        y0: 0,
        y1: 100,
        line: { color: '#EF4444', width: 2 },
      })),
      {
        type: 'rect',
        x0: 0,
        x1: maxMinute,
        y0: 65,
        y1: 100,
        fillcolor: 'rgba(239,68,68,0.08)',
        line: { width: 0 },
      },
      ...cusumMinutes.map((m) => ({
        type: 'line',
        x0: m,
        x1: m,
        y0: 0,
        y1: 100,
        line: { color: '#10B981', width: 1.5, dash: 'dot' },
      })),
    ],
    annotations: goals.map((g) => ({
      x: g.minute,
      y: 97,
      text: '⚽',
      showarrow: false,
      font: { size: 14 },
    })),
    showlegend: true,
    legend: { bgcolor: 'rgba(30, 41, 59, 0.8)', bordercolor: '#334155', font: { color: '#e2e8f0' } },
    margin: { t: 20, b: 40, l: 50, r: 20 },
    autosize: true,
    hovermode: 'x unified' as const,
  };

  return (
    <div className="h-full flex flex-col bg-collapse-bg text-collapse-text overflow-hidden">
      {/* Header Bar */}
      <header className="h-16 shrink-0 bg-collapse-surface border-b border-collapse-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-bold font-sans tracking-tight">
              {match ? `${match.home_team} vs ${match.away_team}` : 'War Room'}
            </h1>
            <p className="text-xs text-collapse-muted font-mono uppercase tracking-wider">
              {match?.competition ?? ''} {match?.season ?? ''}
            </p>
          </div>
          <div className="flex items-center gap-4 bg-collapse-bg/50 px-4 py-2 rounded-lg border border-collapse-border">
            <span className="text-2xl font-bold font-mono text-collapse-safe">
              {match ? `${match.home_score} – ${match.away_score}` : '–'}
            </span>
            <div className="h-4 w-[1px] bg-collapse-border"></div>
            <div className="flex items-center gap-2 text-collapse-warn animate-pulse">
              <Timer className="w-4 h-4" />
              <span className="font-mono font-medium">118:42</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-collapse-risk/10 border border-collapse-risk/20 rounded text-xs font-bold text-collapse-risk uppercase tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-collapse-risk animate-ping"></span>
            High Risk Mode
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Center Panel (Chart) */}
        <div className="flex-1 flex flex-col p-6 min-w-0">
          <div className="flex-1 bg-collapse-surface border border-collapse-border rounded-xl p-4 relative overflow-hidden shadow-lg">
            {timeline.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full min-h-[300px]">
                <div className="space-y-3 w-full px-8">
                  <Skeleton className="h-4 w-full bg-collapse-surface" />
                  <Skeleton className="h-40 w-full bg-collapse-surface" />
                  <Skeleton className="h-4 w-3/4 bg-collapse-surface" />
                </div>
              </div>
            ) : (
              <Plot
                data={traces}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
              />
            )}
          </div>

          {/* Scrubber */}
          <div className="h-20 mt-4 bg-collapse-surface border border-collapse-border rounded-xl p-4 flex items-center gap-4 shadow-lg">
            <span className="font-mono text-sm text-collapse-muted w-12 text-right">0'</span>
            <input
              type="range"
              min="0"
              max={maxMinute}
              value={currentMinute}
              onChange={(e) => setCurrentMinute(parseInt(e.target.value, 10))}
              className="flex-1 h-2 bg-collapse-bg rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-collapse-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
            />
            <span className="font-mono text-sm text-collapse-muted w-12">{maxMinute}'+</span>
            <div className="px-3 py-1 bg-collapse-accent text-white font-mono text-sm rounded min-w-[3rem] text-center">
              {currentMinute}'
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 shrink-0 bg-collapse-surface border-l border-collapse-border p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Probability Gauge */}
          <div className="text-center">
            <h3 className="text-sm font-medium text-collapse-muted uppercase tracking-wider mb-4">Collapse Probability</h3>
            <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
              {/* Simple CSS Gauge */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" fill="none" stroke="#1e293b" strokeWidth="12" />
                <circle 
                  cx="96" cy="96" r="88" fill="none" 
                  stroke={currentRisk > 0.65 ? '#ef4444' : currentRisk > 0.4 ? '#f59e0b' : '#10b981'} 
                  strokeWidth="12" 
                  strokeDasharray={`${2 * Math.PI * 88}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - currentRisk)}`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-bold font-mono ${currentRisk > 0.65 ? 'text-collapse-risk' : 'text-collapse-text'}`}>
                  {(currentRisk * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-collapse-muted mt-1 font-medium uppercase">Current Risk</span>
              </div>
            </div>
          </div>

          {/* Tactical Alert Card */}
          {currentRisk > 0.65 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-collapse-risk/10 border border-collapse-risk/30 rounded-lg p-4 animate-pulse-slow"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-collapse-risk shrink-0" />
                <div>
                  <h4 className="font-bold text-collapse-risk text-sm uppercase mb-1">Critical Alert</h4>
                  <p className="text-sm text-collapse-text leading-tight">defensive line integrity compromised. Left flank overload detected.</p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="border-t border-collapse-border my-2"></div>

          {/* Risk Drivers */}
          <div>
            <h3 className="text-sm font-medium text-collapse-muted uppercase tracking-wider mb-4">Top Risk Drivers</h3>
            <div className="space-y-4">
              {riskDrivers.map((driver, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-collapse-text">{driver.name}</span>
                    <span className="font-mono text-collapse-muted">{driver.value}%</span>
                  </div>
                  <div className="h-2 bg-collapse-bg rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full"
                      style={{ backgroundColor: driver.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${driver.value}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pitch Territory Tilt */}
          <div className="flex-1 flex flex-col justify-end">
             <h3 className="text-sm font-medium text-collapse-muted uppercase tracking-wider mb-4">Territory Tilt</h3>
             <div className="aspect-[2/3] bg-collapse-bg border border-collapse-border rounded-lg relative p-2">
                {/* Simplified Pitch SVG */}
                <svg width="100%" height="100%" viewBox="0 0 100 150">
                  <rect x="0" y="0" width="100" height="150" fill="none" stroke="#334155" strokeWidth="1" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="#334155" strokeWidth="1" />
                  <circle cx="50" cy="75" r="10" fill="none" stroke="#334155" strokeWidth="1" />
                  <rect x="25" y="0" width="50" height="15" fill="none" stroke="#334155" strokeWidth="1" />
                  <rect x="25" y="135" width="50" height="15" fill="none" stroke="#334155" strokeWidth="1" />
                  
                  {/* Heatmap overlay simulation */}
                  <defs>
                    <radialGradient id="tiltGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="30" cy="110" r="25" fill="url(#tiltGradient)" />
                </svg>
                <div className="absolute bottom-2 left-2 right-2 bg-collapse-surface/80 backdrop-blur px-2 py-1 rounded border border-collapse-border text-xs text-center">
                  <span className="text-collapse-risk font-bold">Deep Pressure</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
