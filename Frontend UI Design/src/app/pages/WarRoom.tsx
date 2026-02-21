import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ShieldAlert, Timer, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { getTimeline, getGoals, getWindow, getMatches, getMatchTeams, getCoachSuggestions } from '../../lib/api';
import type { Match, MatchWindow } from '../../lib/types';
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
  const { matchId, team, match, setMatch } = useMatch();
  const [currentMinute, setCurrentMinute] = useState(65);
  const [debouncedMinute, setDebouncedMinute] = useState(65);

  // Picker local state
  const [pickerMatch, setPickerMatch] = useState<Match | null>(null);
  const [filter, setFilter] = useState('');

  const { data: allMatches = [] } = useQuery({ queryKey: ['matches'], queryFn: getMatches });
  const { data: teamsForMatch = [] } = useQuery({
    queryKey: ['match-teams', pickerMatch?.match_id],
    queryFn: () => getMatchTeams(pickerMatch!.match_id),
    enabled: !!pickerMatch,
  });

  // All hooks must be declared before any conditional returns
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

  const riskPercent = Math.round((windowData?.probability ?? currentRisk) * 100);

  // Gemini: only fires when user explicitly clicks "Generate AI Analysis"
  const [aiEnabled, setAiEnabled] = useState(false);
  const prevMinuteRef = useRef(debouncedMinute);
  useEffect(() => {
    if (prevMinuteRef.current !== debouncedMinute) {
      prevMinuteRef.current = debouncedMinute;
      setAiEnabled(false); // reset so user must click again for new minute
    }
  }, [debouncedMinute]);

  const { data: aiData, isFetching: aiLoading, refetch: fetchAi } = useQuery({
    queryKey: ['coach', matchId, debouncedMinute, team],
    queryFn: () => getCoachSuggestions({
      team,
      minute: debouncedMinute,
      risk_percent: riskPercent,
      headline: windowData?.headline ?? '',
      rationale: windowData?.rationale ?? [],
    }),
    enabled: aiEnabled && !!windowData && !!team,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  function requestAi() {
    setAiEnabled(true);
    // If already enabled (e.g. stale), manually refetch
    if (aiEnabled) fetchAi();
  }

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

  // Running score at currentMinute — counts goals up to that minute.
  const liveScore = useMemo(() => {
    if (!match) return { home: 0, away: 0 };
    const homeLower = match.home_team.toLowerCase();
    const awayLower = match.away_team.toLowerCase();
    const home = goals.filter(
      (g) => g.scoring_team.toLowerCase() === homeLower && g.minute <= currentMinute
    ).length;
    const away = goals.filter(
      (g) => g.scoring_team.toLowerCase() === awayLower && g.minute <= currentMinute
    ).length;
    return { home, away };
  }, [goals, currentMinute, match]);

  const filteredMatches = allMatches.filter((m) => {
    const q = filter.toLowerCase();
    return !q || m.home_team.toLowerCase().includes(q) || m.away_team.toLowerCase().includes(q);
  });

  // Clicking a team immediately opens War Room (no confirm step)
  function selectTeam(m: Match, t: string) {
    setMatch(m, t);
  }

  // Show picker when no match confirmed in context
  if (!match) {
    const teamOptions = teamsForMatch.length > 0
      ? teamsForMatch
      : pickerMatch
        ? [pickerMatch.home_team, pickerMatch.away_team]
        : [];

    return (
      <div className="h-full flex flex-col bg-collapse-bg text-collapse-text overflow-hidden">
        <header className="h-16 shrink-0 bg-collapse-surface border-b border-collapse-border px-6 flex items-center">
          <h1 className="text-xl font-bold">War Room</h1>
          <span className="ml-3 text-sm text-collapse-muted font-mono">
            {!pickerMatch ? 'Step 1 — select a match' : 'Step 2 — select your team'}
          </span>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 min-h-0">
          {/* Left — match list */}
          <div className="flex flex-col border-r border-collapse-border min-h-0">
            <div className="p-4 border-b border-collapse-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-collapse-muted" />
                <input
                  type="text"
                  placeholder="Search teams…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full bg-collapse-bg border border-collapse-border rounded-lg pl-9 pr-4 py-2 text-sm text-collapse-text placeholder:text-collapse-muted focus:border-collapse-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-collapse-border">
              {filteredMatches.length === 0 ? (
                <p className="p-6 text-collapse-muted text-sm text-center">No matches found.</p>
              ) : (
                filteredMatches.map((m) => (
                  <button
                    key={m.match_id}
                    onClick={() => setPickerMatch(m)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-collapse-surface ${
                      pickerMatch?.match_id === m.match_id
                        ? 'bg-collapse-accent/10 border-l-2 border-collapse-accent pl-[18px]'
                        : ''
                    }`}
                  >
                    <span className="font-medium text-sm">
                      {m.home_team} <span className="text-collapse-muted">vs</span> {m.away_team}
                    </span>
                    <span className="text-xs text-collapse-muted font-mono ml-3 shrink-0">
                      {m.home_score ?? '?'}–{m.away_score ?? '?'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right — team picker */}
          <div className="flex flex-col items-center justify-center p-10 gap-6">
            {!pickerMatch ? (
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-collapse-border flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-collapse-muted" />
                </div>
                <p className="text-collapse-muted text-sm">Select a match from the left to see the teams</p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="font-semibold text-lg">{pickerMatch.home_team} vs {pickerMatch.away_team}</p>
                  <p className="text-collapse-muted text-sm mt-1 font-mono">
                    {pickerMatch.home_score ?? '?'} – {pickerMatch.away_score ?? '?'} · {pickerMatch.competition}
                  </p>
                </div>
                <p className="text-sm text-collapse-muted uppercase tracking-wider font-mono">
                  Which team are you analysing?
                </p>
                <div className="w-full max-w-xs space-y-3">
                  {teamOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => selectTeam(pickerMatch, t)}
                      className="w-full py-4 rounded-xl border border-collapse-border bg-collapse-surface text-sm font-semibold hover:border-collapse-accent hover:bg-collapse-accent/10 hover:text-collapse-accent transition-all"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-collapse-muted">Click a team to open the War Room</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const chartData = timeline.map((t) => ({
    minute: t.minute,
    risk: Math.round(t.probability * 1000) / 10,
  }));

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
              {match ? `${liveScore.home} – ${liveScore.away}` : '–'}
            </span>
            <div className="h-4 w-[1px] bg-collapse-border"></div>
            <div className="flex items-center gap-2 text-collapse-warn">
              <Timer className="w-4 h-4" />
              <span className="font-mono font-medium">{currentMinute}'</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMatch(null, '')}
            className="px-4 py-2 bg-collapse-surface border border-collapse-border rounded-lg text-sm font-semibold text-collapse-text hover:border-collapse-accent hover:text-collapse-accent transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Change Match
          </button>
          <div className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-all ${
            currentRisk > 0.65
              ? 'bg-collapse-risk/10 border border-collapse-risk/20 text-collapse-risk'
              : currentRisk > 0.4
              ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
              : 'bg-green-500/10 border border-green-500/20 text-green-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${currentRisk > 0.65 ? 'bg-collapse-risk animate-ping' : currentRisk > 0.4 ? 'bg-yellow-400' : 'bg-green-400'}`}></span>
            {currentRisk > 0.65 ? 'High Risk' : currentRisk > 0.4 ? 'Medium Risk' : 'Low Risk'}
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
                  <Skeleton className="h-4 w-full bg-collapse-elevated rounded" />
                  <Skeleton className="h-48 w-full bg-collapse-elevated rounded" />
                  <Skeleton className="h-4 w-3/4 bg-collapse-elevated rounded" />
                  <p className="text-collapse-muted text-xs text-center pt-2">Loading timeline…</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  onClick={(e) => {
                    if (e?.activeLabel !== undefined) setCurrentMinute(Number(e.activeLabel));
                  }}
                  style={{ cursor: 'crosshair' }}
                >
                  <defs>
                    <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="minute"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: 'Match Minute', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: 'Risk %', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                    formatter={(val: number) => [`${val.toFixed(1)}%`, 'Collapse Risk']}
                    labelFormatter={(min) => `Minute ${min}`}
                  />
                  {/* 65% danger zone */}
                  <ReferenceLine y={65} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'High Risk', fill: '#ef4444', fontSize: 10 }} />
                  {/* Goal markers */}
                  {goals.map((g) => (
                    <ReferenceLine key={`goal-${g.minute}`} x={g.minute} stroke="#ef4444" strokeWidth={2} label={{ value: '⚽', position: 'top', fontSize: 12 }} />
                  ))}
                  {/* CUSUM alert markers */}
                  {cusumMinutes.map((m) => (
                    <ReferenceLine key={`cusum-${m}`} x={m} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1.5} />
                  ))}
                  {/* Current minute cursor */}
                  <ReferenceLine x={currentMinute} stroke="#e2e8f0" strokeWidth={2} />
                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="#0EA5E9"
                    strokeWidth={2.5}
                    fill="url(#riskGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#0EA5E9' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
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

          {/* Gemini AI Tactical Card — on-demand only */}
          <div className={`rounded-lg border ${
            currentRisk > 0.65
              ? 'bg-collapse-risk/10 border-collapse-risk/30'
              : currentRisk > 0.4
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-collapse-elevated/40 border-collapse-border'
          }`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-collapse-border/50">
              <div className="flex items-center gap-2">
                {currentRisk > 0.65
                  ? <ShieldAlert className="w-4 h-4 text-collapse-risk" />
                  : <Sparkles className="w-4 h-4 text-collapse-accent" />
                }
                <h4 className={`font-bold text-xs uppercase tracking-wider ${
                  currentRisk > 0.65 ? 'text-collapse-risk' : 'text-collapse-accent'
                }`}>
                  Gemini Analysis
                </h4>
                {aiLoading && (
                  <span className="w-3 h-3 border border-collapse-accent border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {!aiLoading && (
                <button
                  onClick={requestAi}
                  disabled={!windowData}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-collapse-accent/20 text-collapse-accent hover:bg-collapse-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  {aiData ? 'Regenerate' : 'Generate'}
                </button>
              )}
            </div>
            <div className="p-4">
              {aiLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-full bg-collapse-elevated rounded" />
                  <Skeleton className="h-2.5 w-4/5 bg-collapse-elevated rounded" />
                  <Skeleton className="h-2.5 w-3/5 bg-collapse-elevated rounded" />
                  <p className="text-xs text-collapse-muted pt-1">Gemini is analysing minute {debouncedMinute}…</p>
                </div>
              ) : aiData?.suggestions ? (
                <motion.p
                  key={`ai-text-${debouncedMinute}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-collapse-text leading-relaxed whitespace-pre-wrap"
                >
                  {aiData.suggestions}
                </motion.p>
              ) : (
                <p className="text-xs text-collapse-muted italic text-center py-2">
                  {windowData
                    ? 'Click Generate for AI tactical analysis of this minute'
                    : 'Waiting for match data…'}
                </p>
              )}
            </div>
          </div>

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
             {/* key forces full re-render when minute or data changes */}
             {(() => {
               const tilt = windowData?.features.territory_tilt ?? 0;
               // tilt > 0 means opponent pressure (defending deep), < 0 means team pressing high
               const pressure = Math.min(1, Math.abs(tilt));
               const isUnderPressure = tilt > 0;
               // Map pressure 0→1 to vertical position on pitch (50=midfield → 125=deep in own half)
               const hotspotY = isUnderPressure ? 75 + pressure * 55 : 75 - pressure * 55;
               const hotspotR = 15 + pressure * 20;
               const color = isUnderPressure ? '#EF4444' : '#10B981';
               const label = pressure < 0.2 ? 'Balanced' : isUnderPressure
                 ? pressure > 0.6 ? 'Deep Pressure' : 'Under Pressure'
                 : pressure > 0.6 ? 'High Press' : 'Pressing';
               const labelColor = isUnderPressure ? '#EF4444' : '#10B981';
               const pct = Math.round(pressure * 100);
               return (
                 <div key={`tilt-${debouncedMinute}`} className="aspect-[2/3] bg-collapse-bg border border-collapse-border rounded-lg relative p-2">
                   <svg width="100%" height="100%" viewBox="0 0 100 150">
                     {/* Pitch outline */}
                     <rect x="0" y="0" width="100" height="150" fill="none" stroke="#334155" strokeWidth="1" />
                     <line x1="0" y1="75" x2="100" y2="75" stroke="#334155" strokeWidth="1" />
                     <circle cx="50" cy="75" r="10" fill="none" stroke="#334155" strokeWidth="1" />
                     <rect x="25" y="0" width="50" height="15" fill="none" stroke="#334155" strokeWidth="1" />
                     <rect x="25" y="135" width="50" height="15" fill="none" stroke="#334155" strokeWidth="1" />
                     <defs>
                       <radialGradient id="tiltGrad" cx="50%" cy="50%" r="50%">
                         <stop offset="0%" stopColor={color} stopOpacity="0.5" />
                         <stop offset="100%" stopColor={color} stopOpacity="0" />
                       </radialGradient>
                     </defs>
                     <circle cx="50" cy={hotspotY} r={hotspotR} fill="url(#tiltGrad)" />
                     {/* Pressure % bar on left edge */}
                     <rect x="2" y="2" width="4" height="146" fill="#1e293b" rx="2" />
                     <rect x="2" y={2 + (1 - pressure) * 146} width="4" height={pressure * 146} fill={color} rx="2" />
                   </svg>
                   <div className="absolute bottom-2 left-2 right-2 bg-collapse-surface/80 backdrop-blur px-2 py-1 rounded border border-collapse-border text-xs text-center">
                     <span style={{ color: labelColor }} className="font-bold">{label}</span>
                     {windowData && <span className="text-collapse-muted ml-2">{pct}%</span>}
                   </div>
                 </div>
               );
             })()}
          </div>
        </div>
      </div>
    </div>
  );
}
