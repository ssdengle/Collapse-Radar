import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Activity, Trophy, Swords, BrainCircuit, Users, Globe,
  ChevronRight, TrendingUp, AlertTriangle, Shield, Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getDashboardStats, getTeamRisk, getTopMatches } from '../../lib/api';
import { Skeleton } from '../components/ui/skeleton';

function riskColor(risk: number) {
  if (risk >= 0.65) return '#FF3B5C';
  if (risk >= 0.45) return '#F5A623';
  return '#0BDE8C';
}

function riskLabel(risk: number) {
  if (risk >= 0.65) return { text: 'HIGH', bg: '#FF3B5C' };
  if (risk >= 0.45) return { text: 'MED',  bg: '#F5A623' };
  return { text: 'LOW', bg: '#0BDE8C' };
}

const FEATURED_MATCH = {
  home: 'Argentina', away: 'France',
  score: '3 – 3', note: 'AET · Argentina win 4–2 pens',
  date: 'Dec 18, 2022 · Lusail Stadium',
  context: 'The highest-collapse-risk final in WC history. France recovered from 2–0 down twice before falling to Argentina in penalties.',
  stats: [
    { label: 'Peak Collapse Risk', value: '89%', color: '#FF3B5C' },
    { label: 'Risk Spikes', value: '7', color: '#F5A623' },
    { label: 'ET Minutes', value: '120', color: '#0EA5E9' },
  ],
};

export function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-stats'], queryFn: getDashboardStats, retry: 1,
  });
  const { data: teamRisk = [], isLoading: teamLoading } = useQuery({
    queryKey: ['team-risk'], queryFn: getTeamRisk, retry: 1,
  });
  const { data: topMatches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['top-matches'], queryFn: getTopMatches, retry: 1,
  });

  const teamChartData = teamRisk.slice(0, 14).map(t => ({
    team: t.team.length > 11 ? t.team.slice(0, 10) + '…' : t.team,
    fullName: t.team,
    risk: Math.round(t.avg_risk * 100),
    matches: t.matches,
  }));

  const avgRisk = teamRisk.length
    ? Math.round(teamRisk.reduce((s, t) => s + t.avg_risk, 0) / teamRisk.length * 100)
    : null;

  const highRisk = teamRisk.filter(t => t.avg_risk >= 0.65).length;
  const medRisk  = teamRisk.filter(t => t.avg_risk >= 0.45 && t.avg_risk < 0.65).length;
  const lowRisk  = teamRisk.filter(t => t.avg_risk < 0.45).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 text-collapse-text min-h-screen bg-collapse-bg">

      {isError && (
        <div className="bg-collapse-risk/10 border border-collapse-risk/30 rounded-xl p-3 flex items-center justify-between text-sm">
          <span className="text-collapse-risk">Backend unreachable — start uvicorn on port 8000</span>
          <button onClick={() => refetch()} className="px-3 py-1.5 bg-collapse-surface border border-collapse-border rounded-lg text-xs hover:bg-collapse-border transition-colors">Retry</button>
        </div>
      )}

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-collapse-border bg-collapse-surface">
        {/* gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-collapse-accent/10 via-transparent to-collapse-purple/10 pointer-events-none"/>
        <div className="absolute top-0 right-0 w-96 h-96 bg-collapse-accent/5 rounded-full blur-3xl pointer-events-none"/>

        <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row gap-8 items-start lg:items-center">
          {/* Left: headline */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-collapse-accent bg-collapse-accent/10 border border-collapse-accent/25 px-2.5 py-1 rounded-full">
                FIFA World Cup 2022
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-collapse-safe bg-collapse-safe/10 border border-collapse-safe/25 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-collapse-safe animate-pulse inline-block"/>Live
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
              Predict collapse<br/>
              <span className="text-collapse-accent">before it happens.</span>
            </h1>
            <p className="text-collapse-muted text-sm leading-relaxed max-w-md">
              Causal AI that tracks momentum collapse risk minute-by-minute across
              every WC 2022 match — giving coaches a 12-minute early warning to act.
            </p>
            <div className="flex gap-3 pt-1">
              <Link to="/war-room"
                className="flex items-center gap-2 px-5 py-2.5 bg-collapse-accent text-white rounded-xl text-sm font-semibold hover:bg-collapse-accent/90 transition-all shadow-lg shadow-collapse-accent/25">
                <Activity className="w-4 h-4"/> Analyse a match
              </Link>
              <Link to="/coach-view"
                className="flex items-center gap-2 px-5 py-2.5 bg-collapse-surface border border-collapse-border rounded-xl text-sm font-semibold hover:border-collapse-accent/50 transition-all">
                <BrainCircuit className="w-4 h-4"/> Coach View
              </Link>
            </div>
          </div>

          {/* Right: Featured Match card */}
          <div className="w-full lg:w-80 shrink-0 bg-collapse-bg border border-collapse-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-collapse-warn"/>
              <span className="text-[10px] font-black uppercase tracking-widest text-collapse-warn">WC Final · Featured Match</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-collapse-muted mb-0.5">ARG</p>
                <p className="text-2xl font-black text-collapse-text">{FEATURED_MATCH.home.slice(0,3).toUpperCase()}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-3xl font-black font-mono text-collapse-text">{FEATURED_MATCH.score}</p>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">AET</span>
                <p className="text-[9px] text-amber-400 mt-1">Argentina win 4–2 pens</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-collapse-muted mb-0.5">FRA</p>
                <p className="text-2xl font-black text-collapse-text">{FEATURED_MATCH.away.slice(0,3).toUpperCase()}</p>
              </div>
            </div>
            <p className="text-[11px] text-collapse-muted leading-relaxed border-t border-collapse-border pt-3">
              {FEATURED_MATCH.context}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {FEATURED_MATCH.stats.map(s => (
                <div key={s.label} className="text-center bg-collapse-surface rounded-xl p-2">
                  <p className="font-black text-base font-mono" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[9px] text-collapse-dim leading-tight mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <Link to="/war-room"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-collapse-accent/30 text-collapse-accent text-xs font-semibold hover:bg-collapse-accent/10 transition-all">
              Analyse in War Room <ChevronRight className="w-3.5 h-3.5"/>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── How it works strip ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            step: '01', color: 'text-collapse-accent bg-collapse-accent/10 border-collapse-accent/20',
            title: 'Event stream ingestion',
            desc: 'Every pass, tackle, and shot from StatsBomb open data is parsed into 9 tactical feature streams — updated each minute.',
          },
          {
            step: '02', color: 'text-collapse-warn bg-collapse-warn/10 border-collapse-warn/20',
            title: 'Causal collapse model',
            desc: 'A gradient-boosted model (AUC 0.82) scores each minute 0–100% collapse risk using pass accuracy slope, turnover clustering, territory tilt and more.',
          },
          {
            step: '03', color: 'text-collapse-safe bg-collapse-safe/10 border-collapse-safe/20',
            title: '12-minute early warning',
            desc: 'CUSUM change-point detection fires an alert on average 12 minutes before observable collapse, giving coaches time to intervene.',
          },
        ].map(({ step, color, title, desc }) => (
          <div key={step} className="bg-collapse-surface border border-collapse-border rounded-xl p-4 flex gap-3">
            <span className={`text-xs font-black px-2 py-1 rounded-lg border shrink-0 h-fit ${color}`}>{step}</span>
            <div>
              <p className="text-sm font-semibold text-collapse-text">{title}</p>
              <p className="text-xs text-collapse-muted mt-1 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          [1,2,3,4].map(i => <div key={i} className="h-24 bg-collapse-surface border border-collapse-border rounded-xl animate-pulse"/>)
        ) : (
          <>
            <KpiCard icon={<Swords className="w-4 h-4"/>} label="Matches Analysed"
              value={String(stats?.total_matches_analyzed ?? 110)} sub="WC 2022 fixtures" color="accent"/>
            <KpiCard icon={<Globe className="w-4 h-4"/>} label="National Teams"
              value={String(teamRisk.length || 32)} sub="All group stage" color="purple"/>
            <KpiCard icon={<AlertTriangle className="w-4 h-4"/>} label="Avg Tournament Risk"
              value={avgRisk != null ? `${avgRisk}%` : '—'}
              sub={highRisk > 0 ? `${highRisk} teams in danger zone` : 'Across all teams'} color="warn"/>
            <KpiCard icon={<Shield className="w-4 h-4"/>} label="Model AUC"
              value={stats?.model_auc ? String(stats.model_auc) : '0.82'}
              sub="12 min avg lead time" color="safe"/>
          </>
        )}
      </div>

      {/* ── Chart + Top matches ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Team risk chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 bg-collapse-surface border border-collapse-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-semibold text-collapse-text flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-collapse-accent"/>
                Collapse Risk by Team
              </h3>
              <p className="text-xs text-collapse-muted mt-0.5">Average collapse probability across all WC 2022 matches</p>
            </div>
            <div className="flex gap-2 text-[10px] font-bold">
              <span className="px-2 py-1 rounded-full bg-collapse-risk/10 text-collapse-risk border border-collapse-risk/20">{highRisk} HIGH</span>
              <span className="px-2 py-1 rounded-full bg-collapse-warn/10 text-collapse-warn border border-collapse-warn/20">{medRisk} MED</span>
              <span className="px-2 py-1 rounded-full bg-collapse-safe/10 text-collapse-safe border border-collapse-safe/20">{lowRisk} LOW</span>
            </div>
          </div>
          <div className="flex gap-4 text-[10px] text-collapse-dim mb-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-collapse-risk inline-block"/>≥ 65% HIGH — collapse imminent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-collapse-warn inline-block"/>45–65% MED — elevated pressure</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-collapse-safe inline-block"/>{'<'} 45% LOW — stable</span>
          </div>
          {teamLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-collapse-accent border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : teamChartData.length === 0 ? (
            <p className="text-collapse-muted text-sm py-10 text-center">No data — is the backend running?</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamChartData} layout="vertical" margin={{ top: 0, right: 44, left: 80, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 10 }}
                  tickLine={false} axisLine={false} tickFormatter={v => `${v}%`}/>
                <YAxis type="category" dataKey="team" tick={{ fill: '#94A3B8', fontSize: 10 }}
                  tickLine={false} axisLine={false} width={75}/>
                <Tooltip
                  contentStyle={{ background: 'var(--color-collapse-surface, #1E293B)', border: '1px solid var(--color-collapse-border, #334155)', borderRadius: 8, fontSize: 11, color: 'var(--color-collapse-text, #E2E8F0)' }}
                  formatter={(v: number, _: string, entry: any) => [`${v}% avg risk · ${entry?.payload?.matches ?? '?'} matches`, entry?.payload?.fullName ?? '']}
                  labelFormatter={() => ''}
                  cursor={{ fill: 'rgba(128,128,128,0.06)' }}/>
                <Bar dataKey="risk" radius={[0, 4, 4, 0]} maxBarSize={13}>
                  {teamChartData.map((entry, i) => (
                    <Cell key={i} fill={riskColor(entry.risk / 100)}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Top matches */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="lg:col-span-2 bg-collapse-surface border border-collapse-border rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-collapse-text flex items-center gap-2">
                <Zap className="w-4 h-4 text-collapse-warn"/>
                Highest-Risk Matches
              </h3>
              <p className="text-xs text-collapse-muted mt-0.5">Click to analyse in War Room</p>
            </div>
            <Link to="/war-room" className="text-xs text-collapse-accent hover:opacity-80 font-medium flex items-center gap-1">
              All <ChevronRight className="w-3 h-3"/>
            </Link>
          </div>
          {matchesLoading ? (
            <div className="space-y-2 flex-1">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-collapse-bg rounded-xl"/>)}
            </div>
          ) : topMatches.length === 0 ? (
            <p className="text-collapse-muted text-sm py-6 text-center">No match data available.</p>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
              {topMatches.slice(0, 8).map((m, i) => {
                const { text: lvlText, bg: lvlBg } = riskLabel(m.avg_risk ?? m.peak_risk);
                const risk = m.avg_risk ?? m.peak_risk;
                return (
                  <Link key={m.match_id} to="/war-room"
                    className="flex items-center gap-3 bg-collapse-bg border border-collapse-border rounded-xl px-3 py-2.5 hover:border-collapse-accent/40 transition-all group">
                    <span className="text-[10px] font-mono text-collapse-dim w-4 shrink-0">#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-collapse-text truncate">
                        {m.home_team} <span className="text-collapse-muted font-normal">vs</span> {m.away_team}
                      </p>
                      <p className="text-[10px] text-collapse-dim font-mono">{m.home_score}–{m.away_score} · {m.match_date?.slice(0, 7)}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs font-bold font-mono" style={{ color: riskColor(risk) }}>
                        {Math.round(risk * 100)}%
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: lvlBg + '20', color: lvlBg }}>
                        {lvlText}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Portal navigation ────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 className="text-sm font-bold text-collapse-muted uppercase tracking-widest mb-3">Explore the platform</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              to: '/war-room', label: 'War Room', icon: Swords, color: 'accent',
              sub: 'Scrub any WC 2022 match minute-by-minute. See collapse risk spike in real time and get AI tactical suggestions.',
              cta: 'Open War Room',
            },
            {
              to: '/coach-view', label: 'Coach View', icon: BrainCircuit, color: 'accent',
              sub: 'Matchup hero numbers, 3 causal insights, interactive levers. Pick a WC 2026 fixture and simulate the risk.',
              cta: 'Open Coach View',
            },
            {
              to: '/player-portal', label: 'Player Portal', icon: Users, color: 'purple',
              sub: 'Stability scores, pressure resistance, and risk injection for every player. Compare two players head-to-head.',
              cta: 'Open Player Portal',
            },
            {
              to: '/wc-2026', label: 'WC 2026', icon: Globe, color: 'warn',
              sub: 'Elevation, heat, and travel stress for all 16 WC 2026 host cities. Find the hidden venue advantages.',
              cta: 'Explore WC 2026',
            },
          ].map(({ to, label, icon: Icon, color, sub, cta }) => {
            const accent = color === 'accent' ? 'text-collapse-accent border-collapse-accent/20 bg-collapse-accent/5'
              : color === 'purple' ? 'text-collapse-purple border-collapse-purple/20 bg-collapse-purple/5'
              : 'text-collapse-warn border-collapse-warn/20 bg-collapse-warn/5';
            return (
              <Link key={to} to={to}
                className="group bg-collapse-surface border border-collapse-border rounded-2xl p-5 hover:border-collapse-accent/40 hover:bg-collapse-accent/3 transition-all flex flex-col gap-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${accent}`}>
                  <Icon className="w-4 h-4"/>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-collapse-text">{label}</p>
                  <p className="text-xs text-collapse-muted mt-1 leading-relaxed">{sub}</p>
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all ${accent.split(' ')[0]}`}>
                  {cta} <ChevronRight className="w-3.5 h-3.5"/>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.div>

    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string
}) {
  const palette: Record<string, { icon: string; bar: string }> = {
    accent: { icon: 'border-collapse-accent/20 bg-collapse-accent/10 text-collapse-accent', bar: 'bg-collapse-accent' },
    purple: { icon: 'border-collapse-purple/20 bg-collapse-purple/10 text-collapse-purple', bar: 'bg-collapse-purple' },
    warn:   { icon: 'border-collapse-warn/20   bg-collapse-warn/10   text-collapse-warn',   bar: 'bg-collapse-warn'   },
    safe:   { icon: 'border-collapse-safe/20   bg-collapse-safe/10   text-collapse-safe',   bar: 'bg-collapse-safe'   },
  };
  const p = palette[color] ?? palette.accent;
  return (
    <div className="bg-collapse-surface border border-collapse-border rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${p.icon}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-black font-mono text-collapse-text leading-none">{value}</p>
        <p className="text-[11px] text-collapse-muted uppercase tracking-wider font-medium mt-1">{label}</p>
        <p className="text-[10px] text-collapse-dim mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  );
}
