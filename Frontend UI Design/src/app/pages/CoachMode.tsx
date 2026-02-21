import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { PlayCircle, History } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { getTimeline, getGoals, getWindow, getCounterfactual, DEMO_MATCH_ID } from '../../lib/api';

// Formation "5-3-2" -> rows [5, 3, 2] (back to front)
function FormationDiagram({ formation, className = '' }: { formation: string; className?: string }) {
  const rows = formation.split('-').map(Number).filter((n) => n > 0);
  if (rows.length === 0) return null;

  const width = 80;
  const height = 56;
  const padding = 6;
  const cellW = (width - padding * 2) / Math.max(...rows);
  const cellH = (height - padding * 2) / rows.length;
  const r = Math.min(cellW, cellH) * 0.35;

  const positions: { x: number; y: number }[] = [];
  rows.forEach((count, rowIndex) => {
    const y = padding + (rowIndex + 0.5) * cellH;
    for (let i = 0; i < count; i++) {
      const x = padding + (i + 0.5) * (width - padding * 2) / count;
      positions.push({ x, y });
    }
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`shrink-0 rounded border border-collapse-border bg-collapse-bg/50 w-20 h-14 ${className}`}
      aria-label={`Formation ${formation}`}
    >
      {positions.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={r} fill="currentColor" className="text-collapse-accent/70" />
      ))}
    </svg>
  );
}

type TacticId = 'formation' | 'sub-cdm' | 'high-press' | 'sit-deep' | 'switch-wings' | 'double-pivot' | 'narrow-block';

type Tactic = {
  id: TacticId;
  title: string;
  reason: string;
  rank: number;
  formation?: string;
  source: 'current' | 'historical';
};

const SUGGESTED_TACTICS: Tactic[] = [
  { id: 'formation', title: 'Switch to 5-3-2', reason: 'Reinforce defensive width', rank: 1, formation: '5-3-2', source: 'current' },
  { id: 'sub-cdm', title: 'Substitute CDM', reason: 'Fresh legs in midfield pivot', rank: 2, source: 'current' },
  { id: 'double-pivot', title: 'Double pivot in front of back line', reason: 'Reduce space between lines', rank: 3, formation: '4-2-3-1', source: 'current' },
];

const HISTORICAL_TACTICS: Tactic[] = [
  { id: 'high-press', title: 'High press (vs top nation)', reason: 'Worked in similar high-risk spell', rank: 1, formation: '4-3-3', source: 'historical' },
  { id: 'sit-deep', title: 'Sit deep & counter', reason: 'Used successfully in cup tie', rank: 2, formation: '5-4-1', source: 'historical' },
  { id: 'switch-wings', title: 'Switch wing focus', reason: 'Reduced overloads in past fixture', rank: 3, source: 'historical' },
  { id: 'narrow-block', title: 'Narrow mid block', reason: 'Historical: limited central threat', rank: 4, formation: '4-1-4-1', source: 'historical' },
];

const ALL_TACTICS = [...SUGGESTED_TACTICS, ...HISTORICAL_TACTICS];
const TACTIC_COLORS: Record<string, string> = {
  formation: '#10B981',
  'sub-cdm': '#8B5CF6',
  'high-press': '#3B82F6',
  'sit-deep': '#F59E0B',
  'switch-wings': '#EC4899',
  'double-pivot': '#14B8A6',
  'narrow-block': '#6366F1',
};

const DEMO_TEAM = 'Spain';
const CURRENT_MINUTE = 75;

export function CoachMode() {
  const [selectedTacticIds, setSelectedTacticIds] = useState<TacticId[]>([]);
  const [revealed, setRevealed] = useState(false);

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', DEMO_MATCH_ID, DEMO_TEAM],
    queryFn: () => getTimeline(DEMO_MATCH_ID, DEMO_TEAM),
  });
  const { data: goals = [] } = useQuery({
    queryKey: ['goals', DEMO_MATCH_ID],
    queryFn: () => getGoals(DEMO_MATCH_ID),
  });
  const { data: windowData } = useQuery({
    queryKey: ['window', DEMO_MATCH_ID, CURRENT_MINUTE, DEMO_TEAM],
    queryFn: () => getWindow(DEMO_MATCH_ID, CURRENT_MINUTE, DEMO_TEAM),
  });
  const { data: counterfactual = [], refetch: fetchCounterfactual } = useQuery({
    queryKey: ['counterfactual', DEMO_MATCH_ID, CURRENT_MINUTE, DEMO_TEAM],
    queryFn: () => getCounterfactual(DEMO_MATCH_ID, CURRENT_MINUTE, DEMO_TEAM),
    enabled: false,
  });

  const goalMinute = goals[0]?.minute ?? 67;
  const riskPct = windowData ? Math.round(windowData.probability * 100) : 72;
  const headline = windowData?.headline ?? 'Defensive Structure Compromised';
  const rationale = windowData?.rationale ?? ['Increase defensive compactness', 'Lower press intensity', 'Reduce central build-up'];
  const riskDelta = windowData ? Math.abs(Math.round(windowData.risk_delta * 100)) : 45;

  const handleWhatIf = async () => {
    if (selectedTacticIds.length > 0) {
      await fetchCounterfactual();
      setRevealed(true);
    }
  };

  const toggleTactic = (id: TacticId) => {
    setSelectedTacticIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Chart data: actual from timeline + projected from counterfactual when revealed
  const data = timeline.length
    ? timeline.map((t) => {
        const cf = counterfactual.find((c) => c.projected_minute === t.minute);
        return {
          minute: t.minute,
          actual: t.probability,
          projected: revealed && cf != null ? cf.projected_prob : null,
        };
      })
    : Array.from({ length: 80 }, (_, i) => {
        const actual = Math.min(0.95, 0.2 + i / 100 + (i > 50 ? (i - 50) * 0.02 : 0));
        const cf = revealed && counterfactual.find((c) => c.projected_minute === i);
        return { minute: i, actual, projected: cf?.projected_prob ?? null };
      });

  const projectedKeys = revealed ? ['projected'] : [];

  return (
    <div className="h-full p-4 md:p-6 bg-collapse-bg text-collapse-text overflow-auto">
      {/* One clear title + subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold font-sans tracking-tight">Defensive structure at risk</h1>
        <p className="text-collapse-muted text-sm mt-1">Drop in compactness from minute 52. Select tactics and run simulation to compare projected risk.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left: Risk + Tactics in one column */}
        <div className="space-y-4">
          <div className="bg-collapse-surface border border-collapse-border rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-collapse-muted uppercase tracking-wider">Risk</p>
              <p className="text-2xl font-bold">{riskPct}% <span className="text-collapse-risk text-sm">+14%</span></p>
            </div>
            <div className="text-right text-sm text-collapse-muted">
              <p className="font-medium text-collapse-text">8.5 min</p>
              <p className="text-xs">to threshold</p>
            </div>
          </div>

          <div className="bg-collapse-surface border border-collapse-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-collapse-text mb-2">Tactics</h3>
            <p className="text-xs text-collapse-muted mb-3">Pick one or more, then run simulation to compare.</p>
            <div className="space-y-2">
              <p className="text-xs text-collapse-muted uppercase tracking-wider mt-3">Suggested</p>
              {SUGGESTED_TACTICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTactic(t.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors text-left ${
                    selectedTacticIds.includes(t.id) ? 'bg-collapse-accent/10 border-collapse-accent' : 'bg-collapse-bg border-collapse-border hover:border-collapse-accent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs shrink-0 ${selectedTacticIds.includes(t.id) ? 'bg-collapse-accent border-collapse-accent text-white' : 'border-collapse-border'}`}>
                    {selectedTacticIds.includes(t.id) ? '✓' : ''}
                  </span>
                  {t.formation ? <FormationDiagram formation={t.formation} className="!w-12 !h-8" /> : <span className="w-12" />}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-sm block truncate">{t.title}</span>
                    <span className="text-xs text-collapse-muted truncate block">{t.reason}</span>
                  </div>
                </button>
              ))}
              <p className="text-xs text-collapse-muted uppercase tracking-wider mt-3 flex items-center gap-1"><History className="w-3 h-3" /> Historical</p>
              {HISTORICAL_TACTICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTactic(t.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors text-left ${
                    selectedTacticIds.includes(t.id) ? 'bg-collapse-purple/10 border-collapse-purple' : 'bg-collapse-bg border-collapse-border hover:border-collapse-purple'
                  }`}
                >
                  <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs shrink-0 ${selectedTacticIds.includes(t.id) ? 'bg-collapse-purple border-collapse-purple text-white' : 'border-collapse-border'}`}>
                    {selectedTacticIds.includes(t.id) ? '✓' : ''}
                  </span>
                  {t.formation ? <FormationDiagram formation={t.formation} className="!w-12 !h-8" /> : <span className="w-12" />}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-sm block truncate">{t.title}</span>
                    <span className="text-xs text-collapse-muted truncate block">{t.reason}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Single CTA card */}
        <div className="flex flex-col justify-center">
          <motion.div className="bg-collapse-surface border border-collapse-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-collapse-accent flex items-center gap-2 mb-4">
              <PlayCircle className="w-5 h-5" /> Run comparison
            </h3>
            <ul className="space-y-2 text-sm text-collapse-text mb-6">
              {rationale.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
            <p className="text-xs text-collapse-muted mb-4">Impact: <span className="text-collapse-safe font-semibold">-{riskDelta}% risk delta</span></p>
            <button
              onClick={handleWhatIf}
              disabled={revealed}
              className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
                revealed ? 'bg-collapse-border text-collapse-muted' : selectedTacticIds.length > 0 ? 'bg-collapse-accent text-white hover:bg-collapse-accent/90' : 'bg-collapse-border text-collapse-muted cursor-not-allowed'
              }`}
            >
              {revealed ? `Comparing ${selectedTacticIds.length}` : selectedTacticIds.length > 0 ? `Compare ${selectedTacticIds.length} tactic(s)` : 'Select tactics first'}
            </button>
          </motion.div>
        </div>

        {/* Right: Chart */}
        <div className="bg-collapse-surface border border-collapse-border rounded-lg p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold">Simulation</h3>
            {revealed && (
              <button type="button" onClick={() => setRevealed(false)} className="text-xs text-collapse-accent hover:underline">Reset</button>
            )}
          </div>
          <div className="flex-1 w-full relative min-h-[320px]">
          {revealed && selectedTacticIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="absolute top-4 left-4 z-10 bg-collapse-surface/95 backdrop-blur border border-collapse-border rounded-lg p-3 shadow-xl space-y-1"
            >
              <span className="block text-xs text-collapse-muted uppercase font-bold">Comparing</span>
              {selectedTacticIds.map((id) => (
                <span key={id} className="block text-sm font-medium" style={{ color: TACTIC_COLORS[id] ?? '#94a3b8' }}>
                  {ALL_TACTICS.find((t) => t.id === id)?.title ?? id}
                </span>
              ))}
            </motion.div>
          )}

          <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActualCoach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorprojected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="minute" stroke="#334155" tick={{ fill: '#475569' }} />
              <YAxis hide domain={[0, 1]} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={CURRENT_MINUTE} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Intervention', fill: '#F59E0B', fontSize: 10, position: 'insideTopLeft' }} />
              <Area type="monotone" dataKey="actual" name="Actual" stroke="#94a3b8" strokeWidth={2} fill="url(#colorActualCoach)" style={{ opacity: revealed ? 0.4 : 1, transition: 'opacity 0.5s ease' }} />
              <ReferenceLine x={goalMinute} stroke="#EF4444" strokeDasharray="3 3" />
              {revealed && (
                <Area type="monotone" dataKey="projected" name="Projected (What If)" stroke="#10B981" strokeWidth={2} fill="url(#colorprojected)" />
              )}
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
