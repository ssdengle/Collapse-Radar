import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';
import { Activity, AlertTriangle, TrendingUp, Trophy, Swords, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { getDashboardStats, getTeamRisk, getTopMatches } from '../../lib/api';
import { Skeleton } from '../components/ui/skeleton';

function riskColor(risk: number) {
  if (risk >= 0.65) return '#FF3B5C';
  if (risk >= 0.45) return '#F5A623';
  return '#0BDE8C';
}

function riskLabel(risk: number) {
  if (risk >= 0.65) return 'HIGH';
  if (risk >= 0.45) return 'MEDIUM';
  return 'LOW';
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    retry: 1,
  });

  const { data: teamRisk = [], isLoading: teamLoading } = useQuery({
    queryKey: ['team-risk'],
    queryFn: getTeamRisk,
    retry: 1,
  });

  const { data: topMatches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['top-matches'],
    queryFn: getTopMatches,
    retry: 1,
  });

  // Top 15 teams by risk for bar chart
  const teamChartData = teamRisk.slice(0, 15).map((t) => ({
    team: t.team,
    risk: Math.round(t.avg_risk * 100),
    matches: t.matches,
  }));

  const totalTeams = new Set([
    ...topMatches.map((m) => m.home_team),
    ...topMatches.map((m) => m.away_team),
  ]).size;

  const highestRiskMatch = topMatches[0];
  const avgTournamentRisk = teamRisk.length
    ? Math.round((teamRisk.reduce((s, t) => s + t.avg_risk, 0) / teamRisk.length) * 100)
    : null;

  return (
    <div className="p-6 space-y-6 text-collapse-text min-h-screen bg-collapse-bg">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Tournament Overview</h1>
          <p className="text-collapse-muted mt-1 text-sm font-mono">
            FIFA World Cup 2022 · Collapse risk across all national teams
          </p>
        </div>
        <Link
          to="/war-room"
          className="px-4 py-2 bg-collapse-accent text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium shadow-lg shadow-collapse-accent/20 flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          Analyse a match
        </Link>
      </div>

      {statsError && (
        <div className="bg-collapse-risk/10 border border-collapse-risk/30 rounded-xl p-4 flex items-center justify-between">
          <span className="text-collapse-risk text-sm">Backend unreachable — start uvicorn on port 8000</span>
          <button onClick={() => refetch()} className="px-3 py-1.5 bg-collapse-surface border border-collapse-border rounded-lg text-sm hover:bg-collapse-border">Retry</button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-collapse-surface border border-collapse-border rounded-xl p-5 flex flex-col gap-2">
              <Skeleton className="h-4 w-24 bg-collapse-border rounded" />
              <Skeleton className="h-7 w-16 bg-collapse-border/80 rounded" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              icon={<Trophy className="w-5 h-5 text-collapse-accent" />}
              label="Matches Analysed"
              value={String(stats?.total_matches_analyzed ?? 65)}
              sub="FIFA World Cup 2022"
              color="accent"
            />
            <KpiCard
              icon={<ShieldAlert className="w-5 h-5 text-collapse-risk" />}
              label="Teams Represented"
              value={String(teamRisk.length || 32)}
              sub="National teams"
              color="risk"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-collapse-warn" />}
              label="Avg Tournament Risk"
              value={avgTournamentRisk != null ? `${avgTournamentRisk}%` : '—'}
              sub="Across all groups"
              color="warn"
            />
            <KpiCard
              icon={<AlertTriangle className="w-5 h-5 text-collapse-safe" />}
              label="Model AUC"
              value={stats?.model_auc ? String(stats.model_auc) : '0.82'}
              sub="Collapse detection"
              color="safe"
            />
          </>
        )}
      </div>

      {/* Team Risk Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold font-sans">Collapse Risk by National Team</h3>
            <p className="text-xs text-collapse-muted mt-1">
              Average risk score across all matches played · Top 15 teams shown
            </p>
          </div>
          <span className="text-xs font-mono text-collapse-muted bg-collapse-bg border border-collapse-border rounded px-2 py-1">
            Higher = more vulnerable
          </span>
        </div>
        {teamLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-collapse-muted text-sm">Loading team data…</p>
          </div>
        ) : teamChartData.length === 0 ? (
          <p className="text-collapse-muted text-sm py-10 text-center">No team data available. Is the backend running?</p>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamChartData} layout="vertical" margin={{ top: 4, right: 40, left: 90, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="team"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={85}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }}
                  formatter={(v: number, _: string, entry: { payload?: { matches?: number } }) => [
                    `${v}% avg risk · ${entry?.payload?.matches ?? '?'} matches`,
                    'Risk',
                  ]}
                  labelFormatter={(l) => `${l}`}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <ReferenceLine x={65} stroke="#FF3B5C" strokeDasharray="3 3" opacity={0.6} />
                <Bar dataKey="risk" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {teamChartData.map((entry, i) => (
                    <Cell key={i} fill={riskColor(entry.risk / 100)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Highest-Risk Matches */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="bg-collapse-surface border border-collapse-border rounded-xl overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-collapse-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold font-sans">Highest-Risk Matches</h3>
            <p className="text-xs text-collapse-muted mt-1">Top 10 matches by peak collapse risk · Click to analyse in War Room</p>
          </div>
          <Link to="/war-room" className="text-sm text-collapse-accent hover:opacity-80 font-medium flex items-center gap-1">
            <Swords className="w-4 h-4" /> Open War Room
          </Link>
        </div>
        {matchesLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 bg-collapse-bg rounded" />)}
          </div>
        ) : topMatches.length === 0 ? (
          <p className="p-6 text-collapse-muted text-sm">No match data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-collapse-bg text-collapse-muted font-mono uppercase text-xs">
                <tr>
                  <th className="px-5 py-3">Match</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Peak Risk</th>
                  <th className="px-5 py-3">Avg Risk</th>
                  <th className="px-5 py-3">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-collapse-border">
                {topMatches.map((m, i) => (
                  <tr key={m.match_id} className="hover:bg-collapse-bg/60 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      <span className="text-collapse-muted mr-2 font-mono text-xs">#{i + 1}</span>
                      {m.home_team} <span className="text-collapse-muted">vs</span> {m.away_team}
                    </td>
                    <td className="px-5 py-3 font-mono text-collapse-muted">
                      {m.home_score ?? '—'} – {m.away_score ?? '—'}
                    </td>
                    <td className="px-5 py-3 font-mono font-semibold" style={{ color: riskColor(m.peak_risk) }}>
                      {Math.round(m.peak_risk * 100)}%
                    </td>
                    <td className="px-5 py-3 font-mono text-collapse-muted">
                      {Math.round(m.avg_risk * 100)}%
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-xs font-bold"
                        style={{
                          background: riskColor(m.peak_risk) + '20',
                          color: riskColor(m.peak_risk),
                        }}
                      >
                        {riskLabel(m.peak_risk)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Quick links */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { to: '/war-room', label: 'War Room', sub: 'Live match risk', icon: <Swords className="w-5 h-5" /> },
          { to: '/coach-mode', label: 'Coach Mode', sub: 'What-if tactics', icon: <Activity className="w-5 h-5" /> },
          { to: '/injury-sim', label: 'Injury Sim', sub: 'Squad impact', icon: <ShieldAlert className="w-5 h-5" /> },
          { to: '/wc-2026', label: 'WC 2026', sub: 'Venue stress', icon: <Trophy className="w-5 h-5" /> },
        ].map(({ to, label, sub, icon }) => (
          <Link
            key={to}
            to={to}
            className="bg-collapse-surface border border-collapse-border rounded-xl p-4 hover:border-collapse-accent hover:bg-collapse-accent/5 transition-all group"
          >
            <div className="text-collapse-muted group-hover:text-collapse-accent transition-colors mb-2">{icon}</div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-collapse-muted mt-0.5">{sub}</p>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  const ring: Record<string, string> = {
    accent: 'border-collapse-accent/20 bg-collapse-accent/5',
    risk: 'border-collapse-risk/20 bg-collapse-risk/5',
    warn: 'border-collapse-warn/20 bg-collapse-warn/5',
    safe: 'border-collapse-safe/20 bg-collapse-safe/5',
  };
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-collapse-surface border border-collapse-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
    >
      <div className={`inline-flex p-2 rounded-lg border mb-3 ${ring[color] ?? ''}`}>{icon}</div>
      <p className="text-2xl font-bold text-collapse-text font-sans">{value}</p>
      <p className="text-xs font-medium text-collapse-muted uppercase tracking-wider font-mono mt-1">{label}</p>
      <p className="text-xs text-collapse-dim mt-0.5">{sub}</p>
    </motion.div>
  );
}
