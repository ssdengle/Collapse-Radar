import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Activity, Trophy, Swords, BrainCircuit, Users, Globe, Settings } from 'lucide-react';
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

  const teamChartData = teamRisk.slice(0, 12).map(t => ({
    team: t.team.length > 11 ? t.team.slice(0, 10) + '…' : t.team,
    fullName: t.team,
    risk: Math.round(t.avg_risk * 100),
    matches: t.matches,
  }));

  const avgRisk = teamRisk.length
    ? Math.round(teamRisk.reduce((s, t) => s + t.avg_risk, 0) / teamRisk.length * 100)
    : null;

  // Risk distribution for the top chart
  const highRisk   = teamRisk.filter(t => t.avg_risk >= 0.65).length;
  const medRisk    = teamRisk.filter(t => t.avg_risk >= 0.45 && t.avg_risk < 0.65).length;
  const lowRisk    = teamRisk.filter(t => t.avg_risk < 0.45).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 text-collapse-text min-h-screen bg-collapse-bg">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CollapseOS</h1>
          <p className="text-sm text-collapse-muted mt-0.5">FIFA World Cup 2022 · Collapse intelligence platform</p>
        </div>
        <Link to="/war-room"
          className="flex items-center gap-2 px-4 py-2 bg-collapse-accent text-white rounded-xl text-sm font-semibold hover:bg-collapse-accent/90 transition-all shadow-lg shadow-collapse-accent/20">
          <Activity className="w-4 h-4"/>Analyse a match
        </Link>
      </div>

      {isError && (
        <div className="bg-collapse-risk/10 border border-collapse-risk/30 rounded-xl p-4 flex items-center justify-between">
          <span className="text-collapse-risk text-sm">Backend unreachable — start uvicorn on port 8000</span>
          <button onClick={() => refetch()} className="px-3 py-1.5 bg-collapse-surface border border-collapse-border rounded-lg text-xs hover:bg-collapse-border transition-colors">Retry</button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          [1,2,3,4].map(i => <div key={i} className="h-24 bg-collapse-surface border border-collapse-border rounded-xl animate-pulse"/>)
        ) : (
          <>
            <KpiCard icon={<Trophy className="w-4 h-4"/>} label="Matches Analysed" value={String(stats?.total_matches_analyzed ?? 65)} color="accent"/>
            <KpiCard icon={<Globe className="w-4 h-4"/>}   label="National Teams" value={String(teamRisk.length || 32)} color="purple"/>
            <KpiCard icon={<Activity className="w-4 h-4"/>} label="Avg Tournament Risk" value={avgRisk != null ? `${avgRisk}%` : '—'} color="warn"/>
            <KpiCard icon={<BrainCircuit className="w-4 h-4"/>} label="Model AUC" value={stats?.model_auc ? String(stats.model_auc) : '0.82'} color="safe"/>
          </>
        )}
      </div>

      {/* Main content: chart + top matches */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Team risk chart — spans 3 cols */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 bg-collapse-surface border border-collapse-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-collapse-text">Collapse Risk by Team</h3>
              <p className="text-xs text-collapse-muted mt-0.5">Average risk score across WC 2022 matches</p>
            </div>
            <div className="flex gap-2 text-[10px] font-bold">
              <span className="px-2 py-1 rounded-full bg-collapse-risk/10 text-collapse-risk border border-collapse-risk/20">{highRisk} HIGH</span>
              <span className="px-2 py-1 rounded-full bg-collapse-warn/10 text-collapse-warn border border-collapse-warn/20">{medRisk} MED</span>
              <span className="px-2 py-1 rounded-full bg-collapse-safe/10 text-collapse-safe border border-collapse-safe/20">{lowRisk} LOW</span>
            </div>
          </div>
          {teamLoading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-collapse-accent border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : teamChartData.length === 0 ? (
            <p className="text-collapse-muted text-sm py-10 text-center">No data — is the backend running?</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={teamChartData} layout="vertical" margin={{ top: 0, right: 40, left: 80, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 10 }}
                  tickLine={false} axisLine={false} tickFormatter={v => `${v}%`}/>
                <YAxis type="category" dataKey="team" tick={{ fill: '#94A3B8', fontSize: 10 }}
                  tickLine={false} axisLine={false} width={75}/>
                <Tooltip
                  contentStyle={{ background: 'var(--color-collapse-surface, #1E293B)', border: '1px solid var(--color-collapse-border, #334155)', borderRadius: 8, fontSize: 11, color: 'var(--color-collapse-text, #E2E8F0)' }}
                  formatter={(v: number, _: string, entry: any) => [`${v}% avg risk · ${entry?.payload?.matches ?? '?'} matches`, entry?.payload?.fullName ?? '']}
                  labelFormatter={() => ''}
                  cursor={{ fill: 'rgba(128,128,128,0.06)' }}/>
                <Bar dataKey="risk" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {teamChartData.map((entry, i) => (
                    <Cell key={i} fill={riskColor(entry.risk / 100)}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Top matches — spans 2 cols */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="lg:col-span-2 bg-collapse-surface border border-collapse-border rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-collapse-text">Highest-Risk Matches</h3>
              <p className="text-xs text-collapse-muted mt-0.5">Click to analyse in War Room</p>
            </div>
            <Link to="/war-room" className="text-xs text-collapse-accent hover:opacity-80 font-medium">Open →</Link>
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
                const { text: lvlText, bg: lvlBg } = riskLabel(m.peak_risk);
                return (
                  <Link key={m.match_id} to="/war-room"
                    className="flex items-center gap-3 bg-collapse-bg border border-collapse-border rounded-xl px-3 py-2.5 hover:border-collapse-accent/40 transition-all group">
                    <span className="text-[10px] font-mono text-collapse-dim w-4 shrink-0">#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-collapse-text truncate">
                        {m.home_team} <span className="text-collapse-muted font-normal">vs</span> {m.away_team}
                      </p>
                      <p className="text-[10px] text-collapse-dim font-mono">{m.home_score}–{m.away_score}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs font-bold font-mono" style={{ color: riskColor(m.peak_risk) }}>
                        {Math.round(m.peak_risk * 100)}%
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

      {/* Navigation cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { to: '/war-room',      label: 'War Room',     sub: 'Live match risk analysis',   icon: Swords,       color: 'text-collapse-accent' },
          { to: '/coach-view',    label: 'Coach View',   sub: 'Matchup & tactical planning', icon: BrainCircuit, color: 'text-collapse-accent' },
          { to: '/player-portal', label: 'Player Portal',sub: 'Stability & pressure splits', icon: Users,        color: 'text-collapse-purple' },
          { to: '/wc-2026',       label: 'WC 2026',      sub: 'Venue stress & fixtures',     icon: Globe,        color: 'text-collapse-warn' },
          { to: '/settings',      label: 'Settings',     sub: 'Appearance & preferences',    icon: Settings,     color: 'text-collapse-muted' },
        ].map(({ to, label, sub, icon: Icon, color }) => (
          <Link key={to} to={to}
            className="bg-collapse-surface border border-collapse-border rounded-xl p-4 hover:border-collapse-accent/40 hover:bg-collapse-accent/5 transition-all group flex flex-col gap-2">
            <Icon className={`w-5 h-5 ${color} group-hover:text-collapse-accent transition-colors`}/>
            <div>
              <p className="text-sm font-semibold text-collapse-text">{label}</p>
              <p className="text-[11px] text-collapse-muted mt-0.5 leading-tight">{sub}</p>
            </div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    accent: 'border-collapse-accent/20 bg-collapse-accent/5 text-collapse-accent',
    purple: 'border-collapse-purple/20 bg-collapse-purple/5 text-collapse-purple',
    warn:   'border-collapse-warn/20   bg-collapse-warn/5   text-collapse-warn',
    safe:   'border-collapse-safe/20   bg-collapse-safe/5   text-collapse-safe',
  };
  return (
    <div className="bg-collapse-surface border border-collapse-border rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg border ${colors[color] ?? ''}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold font-mono text-collapse-text">{value}</p>
        <p className="text-[11px] text-collapse-muted uppercase tracking-wider font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}
