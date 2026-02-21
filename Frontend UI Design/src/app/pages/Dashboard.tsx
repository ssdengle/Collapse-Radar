import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Swords, AlertTriangle, Activity, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import { getDashboardStats, getTimeline, DEMO_MATCH_ID, API_BASE } from '../../lib/api';
import { Skeleton } from '../components/ui/skeleton';

const DEMO_TEAM = 'Spain';

const recentAlerts = [
  { time: '67\'', match: 'FRA vs ARG', severity: 'HIGH', msg: 'Defensive line integrity drop; left flank overload' },
  { time: '52\'', match: 'FRA vs ARG', severity: 'MEDIUM', msg: 'Midfield compactness below threshold' },
  { time: '88\'', match: 'BRA vs ENG', severity: 'HIGH', msg: 'Collapse risk peak; recommend substitution' },
  { time: '41\'', match: 'ESP vs ITA', severity: 'LOW', msg: 'Press intensity declining' },
  { time: '73\'', match: 'GER vs NED', severity: 'MEDIUM', msg: 'Fatigue-driven gap in zone 6' },
];

export function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    retry: 1,
  });
  const { data: timelineData = [] } = useQuery({
    queryKey: ['timeline', DEMO_MATCH_ID, DEMO_TEAM],
    queryFn: () => getTimeline(DEMO_MATCH_ID, DEMO_TEAM),
    enabled: !statsError,
    retry: 1,
  });
  const collapseRiskTrend = timelineData.length
    ? timelineData.map((t) => ({ minute: t.minute, risk: Math.round(t.probability * 100) }))
    : [
        { minute: 15, risk: 12 },
        { minute: 30, risk: 18 },
        { minute: 45, risk: 28 },
        { minute: 60, risk: 42 },
        { minute: 75, risk: 58 },
        { minute: 90, risk: 72 },
      ];

  return (
    <div className="p-6 space-y-6 text-collapse-text min-h-screen bg-collapse-bg">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Collapse Prediction Engine</h1>
          <p className="text-collapse-muted mt-1 font-mono text-sm">Real-time tactical football collapse prediction</p>
          <p className="text-collapse-muted mt-1 text-sm max-w-2xl">Monitor matches, collapse risk, and tactical alerts. No server or network metrics—focused on match-level risk and interventions.</p>
        </div>
        <Link
          to="/war-room"
          className="px-4 py-2 bg-collapse-accent text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium shadow-lg shadow-collapse-accent/20 flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          Live matches
        </Link>
      </div>

      {/* Stats: matches, high-risk moments, alerts, avg risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 bg-collapse-surface border border-collapse-border rounded-xl p-6 flex flex-col justify-center gap-2">
                <Skeleton className="h-4 w-32 bg-collapse-border rounded" />
                <Skeleton className="h-8 w-20 bg-collapse-border/80 rounded" />
                <p className="text-collapse-muted text-xs">Loading…</p>
              </div>
            ))}
          </>
        ) : statsError ? (
          <div className="col-span-4 p-4 rounded-xl bg-collapse-surface border border-collapse-warn/30 text-collapse-warn text-sm space-y-1">
            <p>Could not load stats. Start the backend from the project root:</p>
            <p className="font-mono text-xs mt-2">cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000</p>
            <p className="text-collapse-muted text-xs mt-2">API URL: {API_BASE}</p>
          </div>
        ) : (
          <>
            <StatCard
              title="Matches monitored"
              value={String(stats?.total_matches_analyzed ?? 0)}
              trend={stats?.demo_match ? '1 demo' : '—'}
              trendUp={true}
              icon={<Swords className="w-5 h-5 text-collapse-accent" />}
              color="safe"
              description="Active matches in the collapse prediction pipeline."
            />
            <StatCard
              title="High-risk moments"
              value={String(stats?.total_warnings_fired ?? 0)}
              trend="warnings fired"
              trendUp={false}
              icon={<AlertTriangle className="w-5 h-5 text-collapse-risk" />}
              color="risk"
              description="Minutes where collapse probability exceeded threshold."
            />
            <StatCard
              title="Model AUC"
              value={stats?.model_auc != null ? String(stats.model_auc) : '—'}
              trend="ROC AUC"
              trendUp={true}
              icon={<AlertTriangle className="w-5 h-5 text-collapse-warn" />}
              color="warn"
              description="Model discrimination (collapse vs non-collapse)."
            />
            <StatCard
              title="Avg lead time"
              value={stats?.avg_lead_time_minutes != null ? `${stats.avg_lead_time_minutes} min` : '—'}
              trend="to threshold"
              trendUp={true}
              icon={<TrendingUp className="w-5 h-5 text-collapse-purple" />}
              color="purple"
              description="Average minutes before collapse risk spike."
            />
          </>
        )}
      </div>

      {/* Collapse risk trend (match-time style) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2 bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold font-sans">Collapse risk trend (representative match)</h3>
            <p className="text-xs text-collapse-muted mt-1">Risk % over match minutes. Use War Room for per-match timeline.</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={collapseRiskTrend}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis dataKey="minute" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}'`} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }} formatter={(v: number) => [`${v}%`, 'Risk']} labelFormatter={(l) => `Minute ${l}`} />
                <Area type="monotone" dataKey="risk" stroke="#0EA5E9" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm"
        >
          <h3 className="text-lg font-semibold font-sans mb-2">Quick links</h3>
          <p className="text-xs text-collapse-muted mb-4">Jump to tactical tools.</p>
          <div className="space-y-2">
            <Link to="/war-room" className="block p-3 rounded-lg border border-collapse-border bg-collapse-bg hover:border-collapse-accent hover:bg-collapse-accent/5 text-sm font-medium transition-colors">
              War Room — live match risk
            </Link>
            <Link to="/coach-mode" className="block p-3 rounded-lg border border-collapse-border bg-collapse-bg hover:border-collapse-accent hover:bg-collapse-accent/5 text-sm font-medium transition-colors">
              Coach Mode — what-if simulation
            </Link>
            <Link to="/injury-sim" className="block p-3 rounded-lg border border-collapse-border bg-collapse-bg hover:border-collapse-accent hover:bg-collapse-accent/5 text-sm font-medium transition-colors">
              Injury Sim — squad & removal impact
            </Link>
            <Link to="/wc-2026" className="block p-3 rounded-lg border border-collapse-border bg-collapse-bg hover:border-collapse-accent hover:bg-collapse-accent/5 text-sm font-medium transition-colors">
              WC 2026 — venue stress
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Recent tactical alerts (not system logs) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-collapse-surface border border-collapse-border rounded-xl overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-collapse-border flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold font-sans">Recent tactical alerts</h3>
            <p className="text-xs text-collapse-muted mt-1">Collapse-risk alerts from the engine (match, minute, recommendation).</p>
          </div>
          <button className="text-sm text-collapse-accent hover:text-collapse-accent/80 font-medium">View all</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-collapse-bg text-collapse-muted font-medium font-mono uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Match</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-collapse-border">
              {recentAlerts.map((alert, i) => (
                <tr key={i} className="hover:bg-collapse-bg/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-collapse-muted">{alert.time}</td>
                  <td className="px-6 py-4 font-mono">{alert.match}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                      alert.severity === 'HIGH' ? 'bg-collapse-risk/10 text-collapse-risk' :
                      alert.severity === 'MEDIUM' ? 'bg-collapse-warn/10 text-collapse-warn' : 'bg-collapse-safe/10 text-collapse-safe'
                    }`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-collapse-text">{alert.msg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon, color, description }: { title: string; value: string; trend: string; trendUp: boolean; icon: React.ReactNode; color: string; description?: string }) {
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
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <div className={`flex items-center text-sm font-medium ${trendUp ? 'text-collapse-safe' : 'text-collapse-risk'}`}>
          {trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
          {trend}
        </div>
      </div>
      <h3 className="text-collapse-muted text-sm font-medium uppercase tracking-wider font-mono mb-1">{title}</h3>
      <p className="text-3xl font-bold text-collapse-text font-sans">{value}</p>
      {description && <p className="text-xs text-collapse-muted mt-2" title={description}>{description}</p>}
    </motion.div>
  );
}
