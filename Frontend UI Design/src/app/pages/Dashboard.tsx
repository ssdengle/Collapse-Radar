import React from 'react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { CheckCircle, ShieldAlert, ArrowUpRight, ArrowDownRight, Server, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { getDashboardStats, getMatches, getMatchTeams, getTimeline, getMatchStats } from '../../lib/api';
import type { Match } from '../../lib/types';
import { useMatch } from '../context/MatchContext';
import { Skeleton } from '../components/ui/skeleton';

// Safe formatters for backend values (work for both DashboardStats and MatchStats)
function formatMatchesAnalyzed(s: { total_matches_analyzed?: number | string } | null): string {
  if (s == null || s.total_matches_analyzed == null) return '—';
  const n = Number(s.total_matches_analyzed);
  return Number.isNaN(n) ? '—' : n.toLocaleString();
}
function formatModelAuc(s: { model_auc?: number | string } | null): string {
  if (s == null || s.model_auc == null) return '—';
  const n = Number(s.model_auc);
  return Number.isNaN(n) ? '—' : n.toFixed(3);
}
function formatLeadTime(s: { avg_lead_time_minutes?: number | string } | null): string {
  if (s == null || s.avg_lead_time_minutes == null) return '—';
  const n = Number(s.avg_lead_time_minutes);
  return Number.isNaN(n) ? '—' : `${n} min`;
}
function formatWarningsFired(s: { total_warnings_fired?: number | string } | null): string {
  if (s == null || s.total_warnings_fired == null) return '—';
  const n = Number(s.total_warnings_fired);
  return Number.isNaN(n) ? '—' : n.toLocaleString();
}

export function Dashboard() {
  const { setMatch, matchId, team } = useMatch();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
  });

  const { data: matchStats, isLoading: matchStatsLoading } = useQuery({
    queryKey: ['match-stats', selectedMatch?.match_id],
    queryFn: () => getMatchStats(selectedMatch!.match_id),
    enabled: !!selectedMatch?.match_id,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: getMatches,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['match-teams', selectedMatch?.match_id],
    queryFn: () => getMatchTeams(selectedMatch!.match_id),
    enabled: !!selectedMatch?.match_id,
  });

  const timelineTeam = teams.length > 0 ? teams[0] : team;
  const {
    data: timeline = [],
    isLoading: timelineLoading,
    isError: timelineError,
  } = useQuery({
    queryKey: ['timeline', selectedMatch?.match_id, timelineTeam],
    queryFn: () => getTimeline(selectedMatch!.match_id, timelineTeam),
    enabled: !!selectedMatch?.match_id && !!timelineTeam,
    retry: false,
  });

  const hasNoTimelineData = !!selectedMatch && !timelineLoading && (timelineError || timeline.length === 0);

  // Default to demo match when stats or matches load
  useEffect(() => {
    if (selectedMatch == null && (stats?.demo_match || matches.length > 0)) {
      const defaultMatch = stats?.demo_match ?? matches[0];
      setSelectedMatch(defaultMatch);
    }
  }, [stats?.demo_match, matches, selectedMatch]);

  // Sync selected match + team to context (for War Room, Coach Mode, etc.)
  useEffect(() => {
    if (selectedMatch && timelineTeam) {
      setMatch(selectedMatch, timelineTeam);
    }
  }, [selectedMatch, timelineTeam, setMatch]);

  const chartData = timeline.map((t) => ({
    minute: t.minute,
    risk: Math.round(t.probability * 100),
    probability: t.probability,
    cusum: t.cusum_flag,
  }));

  // Bucket risk into segments for summary bar chart (0–15, 16–30, ...)
  const riskBuckets = [
    { period: '0–15', low: 0, medium: 0, high: 0 },
    { period: '16–30', low: 0, medium: 0, high: 0 },
    { period: '31–45', low: 0, medium: 0, high: 0 },
    { period: '46–60', low: 0, medium: 0, high: 0 },
    { period: '61–75', low: 0, medium: 0, high: 0 },
    { period: '76–90+', low: 0, medium: 0, high: 0 },
  ];
  timeline.forEach((t) => {
    const idx = t.minute <= 15 ? 0 : t.minute <= 30 ? 1 : t.minute <= 45 ? 2 : t.minute <= 60 ? 3 : t.minute <= 75 ? 4 : 5;
    if (t.probability < 0.4) riskBuckets[idx].low++;
    else if (t.probability < 0.65) riskBuckets[idx].medium++;
    else riskBuckets[idx].high++;
  });

  return (
    <div className="p-6 space-y-6 text-collapse-text min-h-screen bg-collapse-bg">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">CollapseOS Overview</h1>
          <p className="text-collapse-muted mt-1 font-mono text-sm">
            {stats?.last_updated && <span>Updated {stats.last_updated}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-collapse-muted font-medium">Match</span>
          <select
            value={selectedMatch?.match_id ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              const m = matches.find((x) => x.match_id === id) ?? null;
              setSelectedMatch(m);
            }}
            className="bg-collapse-surface border border-collapse-border rounded-lg px-4 py-2 text-sm text-collapse-text focus:border-collapse-accent focus:outline-none min-w-[220px]"
          >
            <option value="">Select match</option>
            {matches.map((m) => (
              <option key={m.match_id} value={m.match_id}>
                {m.home_team} vs {m.away_team} • {m.match_date}
              </option>
            ))}
          </select>
          {selectedMatch && (
            <span className="text-sm text-collapse-muted">
              Viewing as: <span className="text-collapse-accent font-medium">{timelineTeam}</span>
            </span>
          )}
        </div>
      </div>

      {isError && (
        <div className="bg-collapse-risk/10 border border-collapse-risk/30 rounded-xl p-4 flex items-center justify-between">
          <span className="text-collapse-risk text-sm font-medium">
            Could not load dashboard. Is the backend running?
          </span>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-collapse-surface border border-collapse-border rounded-lg text-sm font-medium hover:bg-collapse-border"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading || (!!selectedMatch && matchStatsLoading) ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 bg-collapse-surface rounded-xl" />
          ))
        ) : (
          <>
            <StatCard title="Match Analyzed" value={selectedMatch ? formatMatchesAnalyzed(matchStats ?? null) : formatMatchesAnalyzed(stats ?? null)} trend="" trendUp={true} icon={<CheckCircle className="w-5 h-5 text-collapse-safe" />} color="safe" />
            <StatCard title="Model AUC" value={selectedMatch ? formatModelAuc(matchStats ?? null) : formatModelAuc(stats ?? null)} trend="" trendUp={true} icon={<ShieldAlert className="w-5 h-5 text-collapse-risk" />} color="risk" />
            <StatCard title="Avg Lead Time" value={selectedMatch ? formatLeadTime(matchStats ?? null) : formatLeadTime(stats ?? null)} trend="" trendUp={true} icon={<Server className="w-5 h-5 text-collapse-warn" />} color="warn" />
            <StatCard title="Warnings Fired" value={selectedMatch ? formatWarningsFired(matchStats ?? null) : formatWarningsFired(stats ?? null)} trend="" trendUp={true} icon={<Users className="w-5 h-5 text-collapse-purple" />} color="purple" />
          </>
        )}
      </div>

      {/* Collapse Risk Over Time */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold font-sans mb-4">Collapse Risk Over Time</h3>
        {!selectedMatch ? (
          <p className="text-collapse-muted text-sm">Select a match above.</p>
        ) : timelineLoading ? (
          <div className="h-[280px] flex items-center justify-center">
            <Skeleton className="h-full w-full bg-collapse-bg rounded-lg" />
          </div>
        ) : hasNoTimelineData ? (
          <p className="text-collapse-muted text-sm py-8">
            No timeline data for this match. Risk stats are available for the demo match (France vs Argentina). Run <code className="bg-collapse-bg px-1 rounded">precompute.py</code> to generate stats for all matches.
          </p>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                key={`dashboard-risk-${selectedMatch?.match_id}-${timelineTeam}`}
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashboardRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis dataKey="minute" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }} formatter={(value: number) => [`${value}%`, 'Risk']} labelFormatter={(m) => `Minute ${m}`} />
                <ReferenceLine y={65} stroke="#EF4444" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="risk" stroke="#0EA5E9" strokeWidth={2} fill="url(#dashboardRisk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Risk by period (stacked bar) */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold font-sans mb-4">Risk Distribution by Period</h3>
        {!selectedMatch ? (
          <p className="text-collapse-muted text-sm">Select a match above.</p>
        ) : hasNoTimelineData ? (
          <p className="text-collapse-muted text-sm">No timeline data for selected match.</p>
        ) : chartData.length === 0 ? (
          <p className="text-collapse-muted text-sm">No timeline data for selected match.</p>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                key={`dashboard-period-${selectedMatch?.match_id}-${timelineTeam}`}
                data={riskBuckets}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }} />
                <Bar dataKey="low" name="Low (&lt;40%)" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="medium" name="Medium (40–65%)" fill="#F59E0B" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="high" name="High (65%+)" fill="#EF4444" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon, color }: { title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    safe: 'bg-collapse-safe/10 text-collapse-safe border-collapse-safe/20',
    risk: 'bg-collapse-risk/10 text-collapse-risk border-collapse-risk/20',
    warn: 'bg-collapse-warn/10 text-collapse-warn border-collapse-warn/20',
    purple: 'bg-collapse-purple/10 text-collapse-purple border-collapse-purple/20',
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        {trend ? (
          <div className={`flex items-center text-sm font-medium ${trendUp ? 'text-collapse-safe' : 'text-collapse-risk'}`}>
            {trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            {trend}
          </div>
        ) : null}
      </div>
      <h3 className="text-collapse-muted text-sm font-medium uppercase tracking-wider font-mono mb-1">{title}</h3>
      <p className="text-3xl font-bold text-collapse-text font-sans">{value}</p>
    </motion.div>
  );
}
