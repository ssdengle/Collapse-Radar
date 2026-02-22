import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, ArrowUp, ArrowDown, GitCompare } from 'lucide-react';
import { motion } from 'motion/react';
import { API_BASE } from '../../lib/api';

type Page = 'home' | 'compare';

const get = (path: string) => fetch(`${API_BASE}${path}`).then(r => r.json());

type Player = { id: number; name: string; role: string; stability: number; risk_injection: number; pressure_resistance: number };

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
function PlayerHome() {
  const [sel, setSel] = useState<{ team: string; player: Player } | null>(null);
  const { data } = useQuery({
    queryKey: ['player-impact', sel?.team, sel?.player.id],
    queryFn: () => get(`/api/player/team/${encodeURIComponent(sel!.team)}/player/${sel!.player.id}/impact`),
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

          {/* 3 cards */}
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
