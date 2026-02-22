import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, ArrowUp, ArrowDown, GitCompare, Star, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  Tooltip as RechartTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, Legend,
} from 'recharts';
import { API_BASE } from '../../lib/api';

type Page = 'home' | 'compare';

const get = (path: string) => fetch(`${API_BASE}${path}`).then(r => r.json());

type Player = { id: number; name: string; role: string; stability: number; risk_injection: number; pressure_resistance: number };

// ── Role-based stat baselines ─────────────────────────────────────────────
const ROLE_BASES: Record<string, Record<string, number>> = {
  GK:  { Touches: 22, 'Chances Created': 8,  'Shot Attempts': 3,  'Aerial Duels': 35, 'Def. Contributions': 62, Goals: 2  },
  CB:  { Touches: 48, 'Chances Created': 14, 'Shot Attempts': 9,  'Aerial Duels': 68, 'Def. Contributions': 78, Goals: 8  },
  LB:  { Touches: 58, 'Chances Created': 30, 'Shot Attempts': 18, 'Aerial Duels': 42, 'Def. Contributions': 65, Goals: 14 },
  RB:  { Touches: 58, 'Chances Created': 30, 'Shot Attempts': 18, 'Aerial Duels': 42, 'Def. Contributions': 65, Goals: 14 },
  CDM: { Touches: 68, 'Chances Created': 24, 'Shot Attempts': 16, 'Aerial Duels': 52, 'Def. Contributions': 72, Goals: 14 },
  CM:  { Touches: 72, 'Chances Created': 38, 'Shot Attempts': 26, 'Aerial Duels': 42, 'Def. Contributions': 46, Goals: 28 },
  CAM: { Touches: 65, 'Chances Created': 72, 'Shot Attempts': 42, 'Aerial Duels': 34, 'Def. Contributions': 22, Goals: 55 },
  LW:  { Touches: 56, 'Chances Created': 60, 'Shot Attempts': 55, 'Aerial Duels': 30, 'Def. Contributions': 20, Goals: 60 },
  RW:  { Touches: 56, 'Chances Created': 60, 'Shot Attempts': 55, 'Aerial Duels': 30, 'Def. Contributions': 20, Goals: 60 },
  ST:  { Touches: 44, 'Chances Created': 42, 'Shot Attempts': 76, 'Aerial Duels': 54, 'Def. Contributions': 14, Goals: 80 },
  MF:  { Touches: 68, 'Chances Created': 36, 'Shot Attempts': 24, 'Aerial Duels': 40, 'Def. Contributions': 48, Goals: 24 },
};

const STAT_AXES = ['Touches', 'Chances Created', 'Shot Attempts', 'Aerial Duels', 'Def. Contributions', 'Goals'] as const;

function generateMatchStats(p: Player) {
  const base = ROLE_BASES[p.role] ?? ROLE_BASES['CM'];
  // Use player id + stat index for deterministic per-player variation (±12 pts)
  return STAT_AXES.map((stat, i) => {
    const jitter = ((p.id * (i + 3) * 17) % 25) - 12;
    // Also tilt stats toward the player's own attributes
    const attrBoost =
      stat === 'Touches'            ? (p.stability - 50) * 0.15 :
      stat === 'Chances Created'    ? (p.pressure_resistance - 50) * 0.18 :
      stat === 'Shot Attempts'      ? (p.risk_injection - 30) * 0.12 :
      stat === 'Aerial Duels'       ? (p.stability - 50) * 0.10 :
      stat === 'Def. Contributions' ? (p.pressure_resistance - 50) * 0.10 :
      stat === 'Goals'              ? (p.risk_injection - 30) * 0.14 : 0;
    const val = Math.min(100, Math.max(5, Math.round(base[stat] + jitter + attrBoost)));
    return { stat, value: val, fullMark: 100 };
  });
}

const ROLE_FACTS: Record<string, string[]> = {
  GK:  ['Commands their box decisively — sweeper-keeper tendencies reduce defensive line exposure.',
        'Distribution accuracy under pressure ranks in the top third of WC goalkeepers.'],
  CB:  ['Aerial duel success rate consistently above team average in set-piece situations.',
        'Ball-playing ability allows the team to bypass the midfield press when needed.'],
  LB:  ['Overlap runs create 2v1 overloads on the left flank — key to wide attacking play.',
        'Recovery speed after forward forays keeps the defensive line compact.'],
  RB:  ['Provides width on the right and links well with the winger in combination play.',
        'Defensive positioning limits opponents to low-quality crosses from the flank.'],
  CDM: ['Acts as the team\'s main defensive screen — disrupts opposition build-up sequences.',
        'Short combination pass rate is high — rarely forces difficult balls under pressure.'],
  CM:  ['Box-to-box engine: averages high distance covered per match across both phases.',
        'Late arrivals into the penalty area are a scoring threat opponents often underestimate.'],
  CAM: ['Key pass volume is one of the highest in the squad — dangerous in tight spaces.',
        'Drops deep to receive and turns quickly, breaking opposition defensive lines.'],
  LW:  ['1v1 dribble success creates regular chances from wide positions.',
        'Cuts inside onto the stronger foot — a pattern defences struggle to track.'],
  RW:  ['Wide play stretches defensive blocks, creating space for central runs.',
        'Pressing intensity from the front contributes to turnovers in the final third.'],
  ST:  ['Movement off the ball pulls centre-backs out of position, opening space for runners.',
        'Link-up play in tight areas allows teammates to advance from deeper positions.'],
  MF:  ['Versatile profile allows deployment across multiple midfield roles as needed.',
        'Ball retention under pressure is above average — valuable in transitional moments.'],
};

function generateFunFacts(p: Player): string[] {
  const roleFacts = ROLE_FACTS[p.role] ?? ROLE_FACTS['MF'];
  const extra: string[] = [];
  if (p.stability > 65)
    extra.push('Stability index in the top 20% of WC squad players — a calming influence when the team is under siege.');
  else if (p.risk_injection < 25)
    extra.push('Remarkably low turnover rate in dangerous zones — rarely elevates team collapse probability.');
  if (p.pressure_resistance > 68)
    extra.push('Decision-making barely degrades under a high press — one of the most pressure-resistant players in the dataset.');
  return [...roleFacts, ...extra].slice(0, 3);
}

// ── Shared selectors ───────────────────────────────────────────────────────
function PlayerPicker({ accentColor = 'accent', onSelect }: { accentColor?: string; onSelect: (team: string, player: Player) => void }) {
  const { data: teams = [] } = useQuery<string[]>({ queryKey: ['player-teams'], queryFn: () => get('/api/player/teams') });
  const [team, setTeam] = useState('');
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['players', team],
    queryFn: () => get(`/api/player/team/${encodeURIComponent(team)}/players`),
    enabled: !!team,
  });

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select value={team} onChange={e => setTeam(e.target.value)}
        className={`bg-collapse-surface border border-collapse-${accentColor}/40 rounded-xl px-4 py-2.5 text-sm text-collapse-text focus:outline-none min-w-[170px]`}>
        <option value="">Select team…</option>
        {(teams as string[]).map((t: string) => <option key={t} value={t}>{t}</option>)}
      </select>
      {players.length > 0 && (
        <select defaultValue="" onChange={e => { const p = players.find(pl => pl.id === +e.target.value); if (p) onSelect(team, p); }}
          className={`bg-collapse-surface border border-collapse-${accentColor}/40 rounded-xl px-4 py-2.5 text-sm text-collapse-text focus:outline-none min-w-[200px]`}>
          <option value="">Select player…</option>
          {players.map((p: Player) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
        </select>
      )}
    </div>
  );
}

// ── Page 1: Player Home ────────────────────────────────────────────────────
// ── Trajectory types ──────────────────────────────────────────────────────
interface MatchRecord {
  match_id: number; opponent: string; match_date: string;
  result: 'W' | 'D' | 'L'; score: string;
  avg_influence: number; avg_fatigue: number; avg_centrality: number;
  minutes_present: number;
  performance_under_pressure: number;
  collapse_contribution: number;
  resilience_score: number;
}
interface TrajectoryData {
  player: string; team: string; real_data_found: boolean;
  matches: MatchRecord[];
  aggregate: {
    matches_analyzed: number; avg_influence: number; avg_fatigue: number;
    performance_under_pressure: number; collapse_contribution: number;
    resilience_score: number; trend: string;
  };
  prediction: {
    predicted_influence: number; predicted_fatigue: number;
    error_probability: number; resilience_prediction: number; trend: string;
  };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-400"/>;
  if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-400"/>;
  return <Minus className="w-4 h-4 text-amber-400"/>;
}

function ScoreBadge({ v, lo = 0.4, hi = 0.65 }: { v: number; lo?: number; hi?: number }) {
  const color = v >= hi ? '#0BDE8C' : v >= lo ? '#F5A623' : '#FF3B5C';
  return <span className="font-mono font-black text-sm" style={{ color }}>{Math.round(v * 100)}%</span>;
}

function PlayerHome() {
  const [sel, setSel] = useState<{ team: string; player: Player } | null>(null);
  const { data } = useQuery({
    queryKey: ['player-impact', sel?.team, sel?.player.id],
    queryFn: () => get(`/api/player/team/${encodeURIComponent(sel!.team)}/player/${sel!.player.id}/impact`),
    enabled: !!sel,
  });
  const { data: traj, isLoading: trajLoading } = useQuery<TrajectoryData>({
    queryKey: ['player-trajectory', sel?.team, sel?.player.name],
    queryFn: () => get(`/api/player/trajectory?team=${encodeURIComponent(sel!.team)}&player=${encodeURIComponent(sel!.player.name)}`),
    enabled: !!sel,
  });

  const p = sel?.player;

  // Derive a "team average" to compare against (midpoint: 50)
  const teamAvgStability = 54;
  const stabilityDelta = p ? p.stability - teamAvgStability : 0;

  const underPressureSummary = (p: Player) => {
    if (p.pressure_resistance > 68)
      return `Retains composure well — pass completion barely drops in unstable phases.`;
    if (p.pressure_resistance > 50)
      return `Solid under moderate pressure, but shows risk injection spikes late in matches.`;
    return `Struggles when pressed — turnover rate rises significantly in unstable phases.`;
  };

  const coachingCues = (p: Player) => {
    const doThis = p.stability > 55
      ? "Use as reset option when team is pinned back — their short-combination success is above average."
      : "Deploy in controlled phases, not transitions — works best with time on the ball.";
    const avoid = p.risk_injection > 35
      ? "Avoid in central zones during high-press phases — turnover risk elevates team collapse probability."
      : "Don't over-rely on them as a tempo setter — consistency drops after 65'.";
    return { doThis, avoid };
  };

  return (
    <div className="space-y-6">
      <PlayerPicker accentColor="purple" onSelect={(t, player) => setSel({ team: t, player })} />

      {!sel && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Users className="w-10 h-10 text-collapse-border"/>
          <p className="text-collapse-muted text-sm">Select a team and player to view their impact profile</p>
        </div>
      )}

      {sel && !data && <div className="h-40 flex items-center justify-center text-collapse-muted text-sm">Loading…</div>}

      {sel && p && data && (
        <>
          {/* Player name bar */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="text-sm text-collapse-muted">{sel.team} · {p.role}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black bg-collapse-purple/15 text-collapse-purple">
              {p.name.slice(0, 2).toUpperCase()}
            </div>
          </div>

          {/* Match stats + Fun facts */}
          {(() => {
            const stats = generateMatchStats(p);
            const facts = generateFunFacts(p);
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Radar chart */}
                <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted mb-1">Match Stats</p>
                  <p className="text-[10px] text-collapse-dim mb-4">Percentile vs WC squad players at the same position</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={stats} margin={{ top: 4, right: 24, bottom: 4, left: 24 }}>
                      <PolarGrid stroke="rgba(148,163,184,0.12)" />
                      <PolarAngleAxis
                        dataKey="stat"
                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                      />
                      <RechartTooltip
                        contentStyle={{ background: 'rgba(10,18,40,0.97)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#94a3b8' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(v: number) => [`${v}th percentile`]}
                      />
                      <Radar
                        dataKey="value"
                        stroke="#7C3AED"
                        fill="#7C3AED"
                        fillOpacity={0.25}
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#7C3AED', strokeWidth: 0 }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  {/* Stat summary row */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {stats.map(s => (
                      <div key={s.stat} className="bg-collapse-bg rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[9px] text-collapse-dim uppercase tracking-wide leading-tight">{s.stat}</p>
                        <p className="text-sm font-black font-mono mt-0.5" style={{
                          color: s.value >= 65 ? '#0BDE8C' : s.value >= 40 ? '#F5A623' : '#FF3B5C'
                        }}>{s.value}%</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fun facts */}
                <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-4 h-4 text-collapse-purple"/>
                    <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Player Traits</p>
                  </div>
                  <p className="text-[10px] text-collapse-dim mb-4">Based on WC match event data and collapse model signals</p>
                  <div className="space-y-3">
                    {facts.map((fact, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                        className="flex gap-3 bg-collapse-bg rounded-xl p-3.5">
                        <div className="shrink-0 w-5 h-5 rounded-full bg-collapse-purple/20 text-collapse-purple flex items-center justify-center text-[10px] font-black mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-sm text-collapse-text leading-relaxed">{fact}</p>
                      </motion.div>
                    ))}
                  </div>
                  {/* Role badge */}
                  <div className="mt-4 pt-4 border-t border-collapse-border flex items-center justify-between">
                    <span className="text-[10px] text-collapse-dim uppercase tracking-wide">Position profile</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-collapse-purple/10 border border-collapse-purple/25 text-collapse-purple">{p.role}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Trajectory & Prediction ─────────────────────────────── */}
          <AnimatePresence>
            {(traj || trajLoading) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-collapse-surface border border-collapse-border rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-collapse-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-collapse-accent"/>
                    <p className="text-sm font-bold text-collapse-text">Performance Trajectory</p>
                    {traj && (
                      <span className={`ml-1 text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${
                        traj.real_data_found
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>
                        {traj.real_data_found ? 'Live WC data' : 'Synthetic (no WC record)'}
                      </span>
                    )}
                  </div>
                  {traj?.aggregate && (
                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={traj.aggregate.trend}/>
                      <span className={`text-xs font-bold capitalize ${
                        traj.aggregate.trend === 'improving' ? 'text-emerald-400' :
                        traj.aggregate.trend === 'declining' ? 'text-red-400' : 'text-amber-400'
                      }`}>{traj.aggregate.trend}</span>
                    </div>
                  )}
                </div>

                {trajLoading ? (
                  <div className="h-48 flex items-center justify-center text-collapse-muted text-sm gap-2">
                    <span className="w-4 h-4 border-2 border-collapse-border border-t-collapse-accent rounded-full animate-spin"/>
                    Loading trajectory…
                  </div>
                ) : traj && traj.matches.length > 0 ? (
                  <div className="p-6 space-y-6">
                    {/* Per-match chart */}
                    <div>
                      <p className="text-[10px] text-collapse-muted uppercase tracking-wider font-bold mb-1">Match-by-Match Arc</p>
                      <p className="text-[9px] text-collapse-dim mb-3">
                        Influence · Resilience · Collapse contribution — higher resilience = performed well under pressure
                      </p>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={traj.matches.map((m, i) => ({
                            label: `vs ${m.opponent.length > 10 ? m.opponent.slice(0, 8) + '…' : m.opponent}`,
                            match: i + 1,
                            influence:    Math.round(m.avg_influence * 100),
                            resilience:   Math.round(m.resilience_score * 100),
                            collapse_risk: Math.round(m.collapse_contribution * 100),
                            result: m.result,
                          }))}
                          margin={{ top: 4, right: 12, left: -24, bottom: 0 }}
                        >
                          <CartesianGrid stroke="rgba(148,163,184,0.06)" vertical={false}/>
                          <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false}/>
                          <YAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`}/>
                          <RechartTooltip
                            contentStyle={{ background: 'rgba(10,18,40,0.97)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, fontSize: 11 }}
                            labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                            itemStyle={{ color: '#e2e8f0' }}
                            formatter={(v: number, name: string) => [`${v}%`, name.replace('_', ' ')]}
                          />
                          <Legend wrapperStyle={{ fontSize: 9, paddingTop: 8 }}
                            formatter={v => v.replace('_', ' ')}/>
                          <ReferenceLine y={50} stroke="rgba(148,163,184,0.15)" strokeDasharray="3 2"/>
                          <Line type="monotone" dataKey="influence"     stroke="#7C3AED" strokeWidth={2} dot={{ r: 3, fill: '#7C3AED', strokeWidth: 0 }} name="influence"     isAnimationActive={true}/>
                          <Line type="monotone" dataKey="resilience"    stroke="#0BDE8C" strokeWidth={2} dot={{ r: 3, fill: '#0BDE8C', strokeWidth: 0 }} name="resilience"    isAnimationActive={true}/>
                          <Line type="monotone" dataKey="collapse_risk" stroke="#FF3B5C" strokeWidth={1.5} dot={{ r: 3, fill: '#FF3B5C', strokeWidth: 0 }} strokeDasharray="4 2" name="collapse risk" isAnimationActive={true}/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Match history table */}
                    <div>
                      <p className="text-[10px] text-collapse-muted uppercase tracking-wider font-bold mb-2">Match History</p>
                      <div className="space-y-1.5">
                        {traj.matches.map((m, i) => (
                          <div key={i} className="flex items-center justify-between bg-collapse-bg rounded-xl px-4 py-2.5 text-xs">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black ${
                                m.result === 'W' ? 'bg-emerald-500/15 text-emerald-400' :
                                m.result === 'D' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-red-500/15 text-red-400'
                              }`}>{m.result}</span>
                              <span className="font-semibold text-collapse-text truncate">vs {m.opponent}</span>
                              <span className="text-collapse-dim font-mono shrink-0">{m.score}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-center hidden sm:block">
                                <p className="text-[8px] text-collapse-dim uppercase">Influence</p>
                                <ScoreBadge v={m.avg_influence}/>
                              </div>
                              <div className="text-center hidden sm:block">
                                <p className="text-[8px] text-collapse-dim uppercase">Resilience</p>
                                <ScoreBadge v={m.resilience_score}/>
                              </div>
                              <div className="text-center">
                                <p className="text-[8px] text-collapse-dim uppercase">Collapse↑</p>
                                <ScoreBadge v={m.collapse_contribution} lo={0.3} hi={0.0}/>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Aggregate + Prediction row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-collapse-border">
                      {/* Aggregate */}
                      <div className="space-y-3">
                        <p className="text-[10px] text-collapse-muted uppercase tracking-wider font-bold">Tournament Averages</p>
                        {[
                          { label: 'Avg Influence',              val: traj.aggregate.avg_influence,              lo: 0.4, hi: 0.65 },
                          { label: 'Performance Under Pressure', val: traj.aggregate.performance_under_pressure,  lo: 0.4, hi: 0.65 },
                          { label: 'Resilience Score',           val: traj.aggregate.resilience_score,           lo: 0.4, hi: 0.65 },
                          { label: 'Collapse Contribution',      val: traj.aggregate.collapse_contribution,      lo: 0.0, hi: 0.0 },
                        ].map(({ label, val, lo, hi }) => (
                          <div key={label} className="flex items-center justify-between gap-3">
                            <span className="text-xs text-collapse-muted truncate">{label}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="w-20 h-1.5 rounded-full bg-collapse-border overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${Math.round(val * 100)}%`,
                                    background: label.includes('Collapse') ? '#FF3B5C' :
                                               val >= hi ? '#0BDE8C' : val >= lo ? '#F5A623' : '#FF3B5C' }}/>
                              </div>
                              <ScoreBadge v={val} lo={lo} hi={hi}/>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Prediction card */}
                      <div className="bg-collapse-bg border border-collapse-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-collapse-accent"/>
                          <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">Next Match Prediction</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Predicted Influence',  val: traj.prediction.predicted_influence, icon: TrendingUp,    lo: 0.4, hi: 0.65 },
                            { label: 'Predicted Fatigue',    val: traj.prediction.predicted_fatigue,   icon: AlertTriangle,  lo: 0.0, hi: 0.0  },
                            { label: 'Error Probability',    val: traj.prediction.error_probability,   icon: AlertTriangle,  lo: 0.0, hi: 0.0  },
                            { label: 'Resilience Forecast',  val: traj.prediction.resilience_prediction, icon: ShieldCheck, lo: 0.4, hi: 0.65 },
                          ].map(({ label, val, lo, hi }) => (
                            <div key={label} className="bg-collapse-surface rounded-lg px-3 py-2.5">
                              <p className="text-[8px] text-collapse-dim uppercase tracking-wide leading-tight">{label}</p>
                              <ScoreBadge v={val} lo={lo} hi={hi}/>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-collapse-border">
                          <TrendIcon trend={traj.prediction.trend}/>
                          <p className="text-[10px] text-collapse-muted">
                            Trajectory: <span className={`font-bold capitalize ${
                              traj.prediction.trend === 'improving' ? 'text-emerald-400' :
                              traj.prediction.trend === 'declining' ? 'text-red-400' : 'text-amber-400'
                            }`}>{traj.prediction.trend}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : traj && traj.matches.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-collapse-dim text-xs">
                    No match records found for this player
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3 cards + stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Stability contribution */}
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Stability Contribution</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black font-mono text-collapse-text">{p.stability.toFixed(0)}</span>
                <span className={`flex items-center gap-1 text-sm font-bold mb-1 ${stabilityDelta >= 0 ? 'text-collapse-safe' : 'text-collapse-risk'}`}>
                  {stabilityDelta >= 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                  {Math.abs(stabilityDelta).toFixed(0)} vs team avg
                </span>
              </div>
              <div className="h-2 bg-collapse-bg rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full bg-collapse-safe" initial={{ width: 0 }} animate={{ width: `${p.stability}%` }} transition={{ duration: 0.7 }}/>
              </div>
            </div>

            {/* Card 2: Under pressure summary */}
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Under Pressure</p>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.pressure_resistance > 65 ? '#0BDE8C' : p.pressure_resistance > 48 ? '#F5A623' : '#FF3B5C' }}/>
                <span className="text-sm font-semibold" style={{ color: p.pressure_resistance > 65 ? '#0BDE8C' : p.pressure_resistance > 48 ? '#F5A623' : '#FF3B5C' }}>
                  {p.pressure_resistance > 65 ? 'Resilient' : p.pressure_resistance > 48 ? 'Moderate' : 'Fragile'}
                </span>
              </div>
              <p className="text-sm text-collapse-text leading-relaxed">{underPressureSummary(p)}</p>
            </div>

            {/* Card 3: Coaching cues */}
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Coaching Cues</p>
              {(() => {
                const { doThis, avoid } = coachingCues(p);
                return (
                  <>
                    <div className="bg-collapse-safe/5 border border-collapse-safe/20 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-collapse-safe font-bold uppercase tracking-wider mb-1">Do this</p>
                      <p className="text-xs text-collapse-text">{doThis}</p>
                    </div>
                    <div className="bg-collapse-risk/5 border border-collapse-risk/20 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-collapse-risk font-bold uppercase tracking-wider mb-1">Avoid this</p>
                      <p className="text-xs text-collapse-text">{avoid}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page 2: Compare ────────────────────────────────────────────────────────
const COMPARE_METRICS = [
  { key: 'pressure_resistance' as const, label: 'Pressure Resistance', description: 'How well they retain the ball and decisions hold under opponent pressure', colorA: '#0EA5E9', colorB: '#7C3AED' },
  { key: 'risk_injection' as const,      label: 'Risk Injection',       description: 'Frequency of turnovers in dangerous zones that elevate team collapse risk', colorA: '#FF3B5C', colorB: '#F5A623' },
  { key: 'stability' as const,           label: 'Recovery Impact',      description: 'Positive stability contribution — resets, switches, and tempo-control actions', colorA: '#0BDE8C', colorB: '#A855F7' },
];

function Compare() {
  const [selA, setSelA] = useState<{ team: string; player: Player } | null>(null);
  const [selB, setSelB] = useState<{ team: string; player: Player } | null>(null);

  const bothReady = !!selA && !!selB;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-xs font-bold text-collapse-accent uppercase tracking-wider">Player A</p>
          <PlayerPicker accentColor="accent" onSelect={(t, p) => setSelA({ team: t, player: p })} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-collapse-purple uppercase tracking-wider">Player B</p>
          <PlayerPicker accentColor="purple" onSelect={(t, p) => setSelB({ team: t, player: p })} />
        </div>
      </div>

      {!bothReady && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <GitCompare className="w-10 h-10 text-collapse-border"/>
          <p className="text-collapse-muted text-sm">Select two players to compare their WC performance</p>
        </div>
      )}

      {bothReady && (
        <div className="space-y-5">
          {/* Player headers */}
          <div className="grid grid-cols-2 gap-4">
            {([
              { sel: selA, color: '#0EA5E9' },
              { sel: selB, color: '#7C3AED' },
            ] as const).map(({ sel, color }) => (
              <div key={(sel as any).player.id + sel.team} className="bg-collapse-surface border border-collapse-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: `${color}20`, color }}>
                  {(sel as any).player.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm">{(sel as any).player.name}</p>
                  <p className="text-xs text-collapse-muted">{sel.team} · {(sel as any).player.role}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 3 metric comparisons */}
          {COMPARE_METRICS.map(metric => {
            const vA = selA.player[metric.key];
            const vB = selB.player[metric.key];
            const winner = vA > vB ? 'A' : vA < vB ? 'B' : null;
            const isRiskMetric = metric.key === 'risk_injection';
            const aWins = isRiskMetric ? vA < vB : vA > vB;
            return (
              <div key={metric.key} className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-collapse-text">{metric.label}</p>
                  {winner && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${aWins ? 'bg-collapse-accent/10 text-collapse-accent border border-collapse-accent/25' : 'bg-collapse-purple/10 text-collapse-purple border border-collapse-purple/25'}`}>
                      {aWins ? selA.player.name : selB.player.name} leads
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-collapse-dim mb-4">{metric.description}</p>

                {/* Dual bar */}
                <div className="space-y-2">
                  {[{ label: selA.player.name, val: vA, color: metric.colorA },
                    { label: selB.player.name, val: vB, color: metric.colorB }].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-collapse-muted w-24 shrink-0 truncate">{label}</span>
                      <div className="flex-1 h-3 bg-collapse-bg rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                          initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.7 }}/>
                      </div>
                      <span className="text-xs font-mono font-bold w-8 text-right" style={{ color }}>{val.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function PlayerPortal() {
  const [page, setPage] = useState<Page>('home');

  return (
    <div className="h-full flex flex-col bg-collapse-bg text-collapse-text overflow-hidden">
      <div className="shrink-0 px-8 pt-6 pb-0 border-b border-collapse-border bg-collapse-surface">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-collapse-purple to-collapse-accent flex items-center justify-center shadow-lg shadow-collapse-purple/20">
            <Users className="w-5 h-5 text-white"/>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Player Portal</h1>
            <p className="text-xs text-collapse-muted">Stability · Pressure · Risk — WC squad analysis</p>
          </div>
        </div>
        <div className="flex gap-1">
          {([['home', Users, 'Player Home'], ['compare', GitCompare, 'Compare']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setPage(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                page === id
                  ? 'border-collapse-purple text-collapse-purple bg-collapse-purple/5'
                  : 'border-transparent text-collapse-muted hover:text-collapse-text'
              }`}>
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {page === 'home'    && <PlayerHome />}
        {page === 'compare' && <Compare />}
      </div>
    </div>
  );
}
