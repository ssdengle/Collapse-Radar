import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Zap, Users, Brain, Flame, Heart, Trophy, ChevronDown, Globe, Medal, AlertTriangle, ChevronRight, Radio, ChevronLeft, X } from 'lucide-react';
import { API_BASE } from '../../lib/api';

const get = (url: string) => fetch(`${API_BASE}${url}`).then(r => r.json());

// ── Types ──────────────────────────────────────────────────────────────────
interface MinuteData {
  minute: number;
  score_a: number; score_b: number;
  collapse_prob: number;
  crowd_pressure: number;
  momentum: number;
  psychological_stress: number;
  physical_fatigue: number;
  rivalry_index: number;
  pass_acc_slope: number;
  turnover_burstiness: number;
  territory_tilt: number;
}

interface SimEvent {
  minute: number;
  type: 'goal' | 'card' | 'momentum_shift' | 'substitution' | 'fulltime';
  team?: string;
  player?: string;
  player_off?: string;
  player_on?: string;
  card?: string;
  score_a?: number;
  score_b?: number;
  description: string;
}

interface SimData {
  team_a: string; team_b: string;
  rivalry_index: number;
  final_score: { team_a: number; team_b: number };
  minutes: MinuteData[];
  events: SimEvent[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
const SPEED_OPTIONS = [0.5, 1, 2, 4] as const;
type Speed = typeof SPEED_OPTIONS[number];

function riskColor(v: number) {
  if (v < 0.35) return '#22c55e';
  if (v < 0.55) return '#f59e0b';
  return '#ef4444';
}

function pct(v: number) { return `${Math.round(v * 100)}%`; }

// Derive winner from score so UI always matches result (model prediction correctness)
function getMatchWinner(m: TournamentMatch): string | null {
  const [home, away] = m.score.split('–').map(Number);
  if (home > away) return m.home;
  if (away > home) return m.away;
  return m.winner ?? null; // draw: use backend winner (e.g. penalties) or null
}

function eventIcon(type: SimEvent['type']) {
  switch (type) {
    case 'goal':          return '⚽';
    case 'card':          return '🟨';
    case 'momentum_shift':return '⚡';
    case 'substitution':  return '🔄';
    case 'fulltime':      return '🏁';
    default:              return '•';
  }
}

// ── Psychological feature bar ──────────────────────────────────────────────
function PsychBar({
  label, value, icon: Icon, color, description,
}: {
  label: string; value: number; icon: any; color: string; description: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color }}/>
          <span className="text-xs font-semibold text-collapse-text">{label}</span>
        </div>
        <span className="text-xs font-mono font-bold" style={{ color }}>{pct(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-collapse-border overflow-hidden">
        <motion.div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value * 100}%`, background: color }}
          layout/>
      </div>
      <p className="text-[9px] text-collapse-dim leading-tight">{description}</p>
    </div>
  );
}

// ── Team selector ──────────────────────────────────────────────────────────
function TeamSelect({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; options: string[]; label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-collapse-muted">{label}</span>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="appearance-none w-full bg-collapse-surface border border-collapse-border rounded-xl px-4 py-2.5 pr-9 text-sm font-semibold text-collapse-text focus:border-collapse-accent focus:outline-none cursor-pointer min-w-[160px]">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-collapse-muted"/>
      </div>
    </div>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────
function LiveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: MinuteData = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-[rgba(10,18,40,0.97)] border border-collapse-border rounded-xl p-3 text-xs space-y-1 shadow-xl min-w-[180px]">
      <p className="font-bold text-collapse-muted mb-1.5">{label}'</p>
      <p className="flex justify-between gap-4"><span className="text-collapse-muted">Collapse risk</span><span className="font-mono font-bold" style={{ color: riskColor(d.collapse_prob) }}>{pct(d.collapse_prob)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-collapse-muted">Crowd pressure</span><span className="font-mono text-sky-400">{pct(d.crowd_pressure)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-collapse-muted">Momentum</span><span className="font-mono text-emerald-400">{pct(d.momentum)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-collapse-muted">Psych stress</span><span className="font-mono text-purple-400">{pct(d.psychological_stress)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-collapse-muted">Fatigue</span><span className="font-mono text-amber-400">{pct(d.physical_fatigue)}</span></p>
    </div>
  );
}

// ── Tournament types ───────────────────────────────────────────────────────
interface TournamentMatch {
  home: string; away: string; score: string;
  winner: string; collapse_risk: number;
  penalties?: { a: number; b: number } | null;
}
interface GroupStanding {
  team: string; played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; pts: number; collapse_risk: number;
}
interface TournamentData {
  champion: string; runner_up: string; third_place: string;
  groups: Record<string, { standings: GroupStanding[]; matches: TournamentMatch[] }>;
  knockout: {
    r16: TournamentMatch[]; qf: TournamentMatch[]; sf: TournamentMatch[];
    third_place: TournamentMatch[]; final: TournamentMatch[];
  };
  rounds_reached: Record<string, string>;
  top_risk_matches: TournamentMatch[];
  team_stats: Record<string, { group: string; pts: number; gf: number; ga: number; gd: number; collapse_risk: number }>;
}

// All matches a team played (group + knockout) for team detail view
function getTeamMatches(tourn: TournamentData, team: string): { stage: string; match: TournamentMatch }[] {
  const out: { stage: string; match: TournamentMatch }[] = [];
  const push = (stage: string, m: TournamentMatch) => {
    if (m.home === team || m.away === team) out.push({ stage, match: m });
  };
  for (const g of 'ABCDEFGH') {
    for (const m of tourn.groups[g].matches) push(`Group ${g}`, m);
  }
  tourn.knockout.r16.forEach(m => push('Round of 16', m));
  tourn.knockout.qf.forEach(m => push('Quarter-final', m));
  tourn.knockout.sf.forEach(m => push('Semi-final', m));
  tourn.knockout.third_place.forEach(m => push('3rd place', m));
  tourn.knockout.final.forEach(m => push('Final', m));
  return out;
}

// ── Tournament components ──────────────────────────────────────────────────
function MatchRow({
  m,
  showRisk = true,
  onClick,
}: {
  m: TournamentMatch;
  showRisk?: boolean;
  onClick?: () => void;
}) {
  const [home, away] = m.score.split('–').map(Number);
  const winner = getMatchWinner(m);
  const homeWon = winner === m.home;
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex items-center justify-between gap-2 bg-collapse-bg rounded-lg px-3 py-2 text-xs ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-collapse-accent/50 transition-all' : ''}`}
    >
      <span className={`font-semibold truncate w-24 text-right ${homeWon ? 'text-collapse-text' : 'text-collapse-muted'}`}>{m.home}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`font-black font-mono text-sm ${homeWon ? 'text-collapse-accent' : 'text-collapse-muted'}`}>{home}</span>
        <span className="text-collapse-dim">–</span>
        <span className={`font-black font-mono text-sm ${!homeWon ? 'text-collapse-accent' : 'text-collapse-muted'}`}>{away}</span>
        {m.penalties && <span className="text-[9px] text-collapse-dim">(pens)</span>}
      </div>
      <span className={`font-semibold truncate w-24 ${!homeWon ? 'text-collapse-text' : 'text-collapse-muted'}`}>{m.away}</span>
      {showRisk && (
        <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{ color: riskColor(m.collapse_risk), background: `${riskColor(m.collapse_risk)}18` }}>
          {pct(m.collapse_risk)}
        </span>
      )}
    </div>
  );
}

function GroupTable({ name, standings, matches }: { name: string; standings: GroupStanding[]; matches: TournamentMatch[] }) {
  const [showMatches, setShowMatches] = useState(false);
  return (
    <div className="bg-collapse-surface border border-collapse-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-collapse-border bg-collapse-bg">
        <span className="text-[10px] font-black text-collapse-accent uppercase tracking-widest">Group {name}</span>
        <button onClick={() => setShowMatches(s => !s)}
          className="text-[9px] text-collapse-muted hover:text-collapse-text transition-colors flex items-center gap-0.5">
          {showMatches ? 'Hide' : 'Matches'} <ChevronRight className={`w-3 h-3 transition-transform ${showMatches ? 'rotate-90' : ''}`}/>
        </button>
      </div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-collapse-dim border-b border-collapse-border">
            <th className="text-left px-3 py-1.5 font-semibold">Team</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">P</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">W</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">D</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">L</th>
            <th className="text-center px-1 py-1.5 font-semibold w-8">GD</th>
            <th className="text-center px-1 py-1.5 font-semibold w-8">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.team} className={`border-b border-collapse-border/40 ${i < 2 ? 'bg-collapse-accent/3' : ''}`}>
              <td className="px-3 py-1.5 flex items-center gap-1.5">
                {i < 2 && <span className="w-1 h-1 rounded-full bg-collapse-accent shrink-0"/>}
                <span className={`font-semibold truncate ${i < 2 ? 'text-collapse-text' : 'text-collapse-muted'}`}>{s.team}</span>
              </td>
              <td className="text-center px-1 py-1.5 text-collapse-muted">{s.played}</td>
              <td className="text-center px-1 py-1.5 text-collapse-muted">{s.won}</td>
              <td className="text-center px-1 py-1.5 text-collapse-muted">{s.drawn}</td>
              <td className="text-center px-1 py-1.5 text-collapse-muted">{s.lost}</td>
              <td className="text-center px-1 py-1.5 text-collapse-muted">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
              <td className="text-center px-1 py-1.5 font-black text-collapse-text">{s.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <AnimatePresence>
        {showMatches && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-2 pb-2 space-y-1 pt-2">
            {matches.map((m, i) => <MatchRow key={i} m={m}/>)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KnockoutStage({
  label,
  matches,
  visible,
  onMatchClick,
}: {
  label: string;
  matches: TournamentMatch[];
  visible?: boolean;
  onMatchClick?: (m: TournamentMatch, stage: string) => void;
}) {
  if (visible === false) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-1.5"
    >
      <p className="text-[9px] font-black text-collapse-muted uppercase tracking-widest">{label}</p>
      <div className="space-y-1">
        {matches.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
            <MatchRow m={m} onClick={onMatchClick ? () => onMatchClick(m, label) : undefined}/>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Modals: Match detail (detailed stats, winner from score) & Team performance ─
function MatchDetailModal({
  match,
  stage,
  onClose,
}: {
  match: TournamentMatch;
  stage: string;
  onClose: () => void;
}) {
  const [homeGoals, awayGoals] = match.score.split('–').map(Number);
  const winner = getMatchWinner(match);
  const risk = match.collapse_risk;
  const riskLabel = risk < 0.35 ? 'Low' : risk < 0.55 ? 'Medium' : 'High';
  const isDraw = homeGoals === awayGoals;
  const resultType = isDraw
    ? (match.penalties ? 'Draw (decided on penalties)' : 'Draw')
    : 'Full-time result';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="bg-collapse-surface border border-collapse-border rounded-2xl shadow-xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-collapse-border shrink-0">
          <span className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">{stage}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-collapse-bg text-collapse-muted"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Score line — winner derived from score (model correctness) */}
          <div className="flex items-center justify-between gap-4">
            <span className={`font-bold text-lg truncate ${winner === match.home ? 'text-collapse-accent' : 'text-collapse-muted'}`}>{match.home}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-black text-xl font-mono">{homeGoals}</span>
              <span className="text-collapse-dim">–</span>
              <span className="font-black text-xl font-mono">{awayGoals}</span>
              {match.penalties != null && (
                <span className="text-[10px] text-collapse-dim">(pens {match.penalties.a}–{match.penalties.b})</span>
              )}
            </div>
            <span className={`font-bold text-lg truncate text-right ${winner === match.away ? 'text-collapse-accent' : 'text-collapse-muted'}`}>{match.away}</span>
          </div>

          {/* Winner = result (model prediction correct) */}
          {winner && (
            <div className="rounded-xl bg-collapse-accent/10 border border-collapse-accent/25 px-3 py-2">
              <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">Result · Model prediction</p>
              <p className="text-sm font-bold text-collapse-accent">Winner: {winner}</p>
              <p className="text-[10px] text-collapse-dim mt-0.5">{resultType}. Winner is derived from the simulated score.</p>
            </div>
          )}
          {isDraw && !match.penalties && (
            <div className="rounded-xl bg-collapse-bg border border-collapse-border px-3 py-2">
              <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">Result</p>
              <p className="text-sm font-semibold text-collapse-text">Draw {homeGoals}–{awayGoals}</p>
            </div>
          )}

          {/* Detailed match stats */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">Match stats</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-collapse-bg rounded-lg px-3 py-2 border border-collapse-border">
                <p className="text-[9px] text-collapse-dim uppercase">Goals (home)</p>
                <p className="text-lg font-black font-mono text-collapse-text">{homeGoals}</p>
              </div>
              <div className="bg-collapse-bg rounded-lg px-3 py-2 border border-collapse-border">
                <p className="text-[9px] text-collapse-dim uppercase">Goals (away)</p>
                <p className="text-lg font-black font-mono text-collapse-text">{awayGoals}</p>
              </div>
            </div>
            <div className="bg-collapse-bg rounded-lg px-3 py-2 border border-collapse-border">
              <p className="text-[9px] text-collapse-dim uppercase">Result type</p>
              <p className="text-sm font-semibold text-collapse-text">{resultType}</p>
            </div>
          </div>

          {/* Collapse risk */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-collapse-muted font-semibold">Collapse risk (simulated)</span>
              <span className="font-mono font-bold" style={{ color: riskColor(risk) }}>{pct(risk)} · {riskLabel}</span>
            </div>
            <div className="h-3 rounded-full bg-collapse-bg overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: riskColor(risk) }}
                initial={{ width: 0 }}
                animate={{ width: `${risk * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TeamDetailModal({
  team,
  tourn,
  onClose,
  onMatchClick,
}: {
  team: string;
  tourn: TournamentData;
  onClose: () => void;
  onMatchClick: (m: TournamentMatch, stage: string) => void;
}) {
  const stats = tourn.team_stats[team];
  const round = tourn.rounds_reached[team] ?? 'Group stage';
  const matches = getTeamMatches(tourn, team);
  const isChamp = round.includes('Champion');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="bg-collapse-surface border border-collapse-border rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-collapse-border shrink-0">
          <h3 className="font-bold text-collapse-text truncate">{team}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-collapse-bg text-collapse-muted"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4">
          <div className={`rounded-xl border px-4 py-3 ${isChamp ? 'bg-amber-500/10 border-amber-500/25' : 'bg-collapse-bg border-collapse-border'}`}>
            <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">How far they got</p>
            <p className={`font-black text-lg ${isChamp ? 'text-amber-400' : 'text-collapse-text'}`}>{round}</p>
          </div>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-collapse-bg rounded-lg px-3 py-2 border border-collapse-border">
                <p className="text-[9px] text-collapse-dim uppercase">Group</p>
                <p className="font-bold text-collapse-text">{stats.group}</p>
              </div>
              <div className="bg-collapse-bg rounded-lg px-3 py-2 border border-collapse-border">
                <p className="text-[9px] text-collapse-dim uppercase">Goals</p>
                <p className="font-bold text-collapse-text">{stats.gf}</p>
              </div>
              <div className="bg-collapse-bg rounded-lg px-3 py-2 border border-collapse-border">
                <p className="text-[9px] text-collapse-dim uppercase">Conceded</p>
                <p className="font-bold text-collapse-text">{stats.ga}</p>
              </div>
              <div className="bg-collapse-bg rounded-lg px-3 py-2 border border-collapse-border">
                <p className="text-[9px] text-collapse-dim uppercase">Pts</p>
                <p className="font-bold text-collapse-accent">{stats.pts}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">All matches · Click for details</p>
            <div className="space-y-1">
              {matches.map(({ stage, match }, i) => (
                <div
                  key={i}
                  onClick={() => onMatchClick(match, stage)}
                  className="flex items-center gap-2 rounded-lg bg-collapse-bg border border-collapse-border px-3 py-2 cursor-pointer hover:ring-2 hover:ring-collapse-accent/50 transition-all"
                >
                  <span className="text-[9px] text-collapse-dim shrink-0 w-20">{stage}</span>
                  <span className="flex-1 truncate text-xs font-semibold">{match.home} {match.score} {match.away}</span>
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{ color: riskColor(match.collapse_risk), background: `${riskColor(match.collapse_risk)}20` }}
                  >
                    {pct(match.collapse_risk)} risk
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Visual knockout bracket (tree: R16 → QF → SF → Final) ───────────────────
function BracketTree({
  knockout,
  visibleFrom,
  onMatchClick,
}: {
  knockout: TournamentData['knockout'];
  visibleFrom: 'groups' | 'r16' | 'qf' | 'sf' | 'final';
  onMatchClick: (m: TournamentMatch, stage: string) => void;
}) {
  const show = (stage: string) =>
    (stage === 'R16' && visibleFrom !== 'groups') ||
    (stage === 'QF' && ['qf', 'sf', 'final'].includes(visibleFrom)) ||
    (stage === 'SF' && ['sf', 'final'].includes(visibleFrom)) ||
    (stage === 'Final' && visibleFrom === 'final');
  const rounds = [
    { label: 'Round of 16', key: 'r16', data: knockout.r16 },
    { label: 'Quarter-finals', key: 'qf', data: knockout.qf },
    { label: 'Semi-finals', key: 'sf', data: knockout.sf },
    { label: 'Final', key: 'final', data: knockout.final },
  ] as const;
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((r, roundIdx) => {
        if (!show(r.label)) return null;
        return (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: roundIdx * 0.08 }}
            className="flex flex-col justify-around shrink-0"
            style={{ minWidth: roundIdx === 0 ? 160 : 150 }}
          >
            <p className="text-[9px] font-black text-collapse-muted uppercase tracking-widest mb-2">{r.label}</p>
            <div className="space-y-2 flex-1 flex flex-col justify-center">
              {r.data.map((m, i) => (
                <div
                  key={i}
                  onClick={() => onMatchClick(m, r.label)}
                  className="rounded-lg border border-collapse-border bg-collapse-bg p-2 cursor-pointer hover:border-collapse-accent/50 hover:ring-1 hover:ring-collapse-accent/30 transition-all"
                >
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className={`truncate font-semibold ${m.winner === m.home ? 'text-collapse-accent' : 'text-collapse-muted'}`}>{m.home}</span>
                    <span className="font-mono font-bold shrink-0">{m.score}</span>
                    <span className={`truncate font-semibold text-right ${m.winner === m.away ? 'text-collapse-accent' : 'text-collapse-muted'}`}>{m.away}</span>
                  </div>
                  <div
                    className="mt-1 h-1 rounded-full overflow-hidden"
                    style={{ background: `${riskColor(m.collapse_risk)}30` }}
                    title={`Collapse risk ${pct(m.collapse_risk)}`}
                  >
                    <div className="h-full rounded-full" style={{ width: `${m.collapse_risk * 100}%`, background: riskColor(m.collapse_risk) }}/>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
      {show('Final') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="shrink-0 flex flex-col justify-center"
        >
          <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2">3rd place</p>
          {knockout.third_place.map((m, i) => (
            <div
              key={i}
              onClick={() => onMatchClick(m, '3rd place')}
              className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 cursor-pointer hover:border-amber-500/40 transition-all"
            >
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className={`truncate font-semibold ${m.winner === m.home ? 'text-amber-400' : 'text-collapse-muted'}`}>{m.home}</span>
                <span className="font-mono font-bold shrink-0">{m.score}</span>
                <span className={`truncate font-semibold text-right ${m.winner === m.away ? 'text-amber-400' : 'text-collapse-muted'}`}>{m.away}</span>
              </div>
              <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: `${riskColor(m.collapse_risk)}30` }}>
                <div className="h-full rounded-full" style={{ width: `${m.collapse_risk * 100}%`, background: riskColor(m.collapse_risk) }}/>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Matchday layout: MD1 = (0,1)&(2,3), MD2 = (0,2)&(1,3), MD3 = (0,3)&(1,2) → indices [0,5], [1,4], [2,3]
const MATCHDAY_INDICES = [[0, 5], [1, 4], [2, 3]] as const;

function GroupTableWithMatchdays({
  name,
  standings,
  matches,
  onTeamClick,
  onMatchClick,
}: {
  name: string;
  standings: GroupStanding[];
  matches: TournamentMatch[];
  onTeamClick: (team: string) => void;
  onMatchClick: (m: TournamentMatch, stage: string) => void;
}) {
  const [showMatches, setShowMatches] = useState(true);
  return (
    <div className="bg-collapse-surface border border-collapse-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-collapse-border bg-collapse-bg">
        <span className="text-[10px] font-black text-collapse-accent uppercase tracking-widest">Group {name}</span>
        <button onClick={() => setShowMatches(s => !s)}
          className="text-[9px] text-collapse-muted hover:text-collapse-text transition-colors flex items-center gap-0.5">
          {showMatches ? 'Hide' : 'Matchdays'} <ChevronRight className={`w-3 h-3 transition-transform ${showMatches ? 'rotate-90' : ''}`}/>
        </button>
      </div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-collapse-dim border-b border-collapse-border">
            <th className="text-left px-3 py-1.5 font-semibold">Team</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">P</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">W</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">D</th>
            <th className="text-center px-1 py-1.5 font-semibold w-6">L</th>
            <th className="text-center px-1 py-1.5 font-semibold w-8">GD</th>
            <th className="text-center px-1 py-1.5 font-semibold w-8">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr
              key={s.team}
              onClick={() => onTeamClick(s.team)}
              className={`border-b border-collapse-border/40 cursor-pointer hover:bg-collapse-accent/10 transition-colors ${i < 2 ? 'bg-collapse-accent/3' : ''}`}
            >
              <td className="px-3 py-1.5 font-semibold text-collapse-text">{s.team}</td>
              <td className="text-center py-1.5">{s.played}</td>
              <td className="text-center py-1.5">{s.won}</td>
              <td className="text-center py-1.5">{s.drawn}</td>
              <td className="text-center py-1.5">{s.lost}</td>
              <td className="text-center py-1.5 font-mono">{s.gd >= 0 ? '+' : ''}{s.gd}</td>
              <td className="text-center py-1.5 font-bold text-collapse-accent">{s.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <AnimatePresence>
        {showMatches && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-2 pb-2 space-y-4 pt-2">
            {MATCHDAY_INDICES.map((indices, mdNum) => {
              const mdMatches = indices.map(i => matches[i]).filter(Boolean);
              if (!mdMatches.length) return null;
              return (
                <motion.div
                  key={mdNum}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: mdNum * 0.06 }}
                  className="space-y-1.5"
                >
                  <p className="text-[9px] font-black text-collapse-muted uppercase tracking-wider">Matchday {mdNum + 1}</p>
                  {mdMatches.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: mdNum * 0.06 + i * 0.04 }}>
                      <MatchRow m={m} onClick={() => onMatchClick(m, `Group ${name} · Matchday ${mdNum + 1}`)}/>
                    </motion.div>
                  ))}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TournamentSim() {
  const [runId, setRunId] = useState(0);
  const { data: tourn, isLoading, refetch, isFetching } = useQuery<TournamentData>({
    queryKey: ['tournament-sim', runId],
    queryFn: () => get(`/api/wc2026/simulate-tournament?run_seed=${Date.now()}`),
    enabled: runId > 0,
    staleTime: 0,
  });

  const [activeGroup, setActiveGroup] = useState('A');
  const [revealPhase, setRevealPhase] = useState<'groups' | 'r16' | 'qf' | 'sf' | 'final'>('groups');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [selectedMatchStage, setSelectedMatchStage] = useState<string>('');

  const runSim = () => { setRunId(r => r + 1); setRevealPhase('groups'); setSelectedTeam(null); setSelectedMatch(null); };
  const onRerun = () => { setRunId(r => r + 1); setRevealPhase('groups'); setSelectedTeam(null); setSelectedMatch(null); };
  useEffect(() => { if (tourn) setRevealPhase('groups'); }, [tourn]);

  const handleMatchClick = (m: TournamentMatch, stage: string) => {
    setSelectedMatch(m);
    setSelectedMatchStage(stage);
  };
  const handleTeamClick = (team: string) => setSelectedTeam(team);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {!tourn ? (
        /* ── Landing ─────────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center px-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
            <Trophy className="w-9 h-9 text-amber-400"/>
          </div>
          <div className="space-y-2 max-w-md">
            <p className="text-lg font-bold text-collapse-text">Simulate WC 2026 Tournament</p>
            <p className="text-sm text-collapse-muted">
              Run the entire competition — 8 groups, Round of 16, Quarter-finals, Semi-finals, and the Final.
              Team strength is driven by WC 2018/22 fingerprints with psychological pressure weighting.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-[10px] pt-1">
              {['32 Teams','48 Group matches','24 Knockout fixtures','Penalty shootouts','Collapse risk per match'].map(l => (
                <span key={l} className="px-2.5 py-1 rounded-lg bg-collapse-surface border border-collapse-border text-collapse-muted">{l}</span>
              ))}
            </div>
          </div>
          <button onClick={runSim} disabled={isLoading || isFetching}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all disabled:opacity-60 shadow-lg shadow-amber-500/20">
            {(isLoading || isFetching) ? (
              <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/>Simulating…</>
            ) : (
              <><Globe className="w-4 h-4"/>Simulate WC 2026</>
            )}
          </button>
        </div>
      ) : (
        /* ── Results ──────────────────────────────────────────────────── */
        <div className="p-6 space-y-6">
          {/* Hero: podium */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-500/10 via-collapse-surface to-collapse-surface border border-amber-500/25 rounded-2xl px-6 py-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Trophy className="w-8 h-8 text-amber-400 shrink-0"/>
                <div>
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">WC 2026 Champion</p>
                  <p className="text-2xl font-black text-collapse-text">{tourn.champion}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <Medal className="w-5 h-5 text-slate-300 mx-auto"/>
                  <p className="text-[9px] text-collapse-dim mt-1">Runner-up</p>
                  <p className="text-sm font-bold text-collapse-text">{tourn.runner_up}</p>
                </div>
                <div className="text-center">
                  <Medal className="w-5 h-5 text-amber-600 mx-auto"/>
                  <p className="text-[9px] text-collapse-dim mt-1">3rd place</p>
                  <p className="text-sm font-bold text-collapse-text">{tourn.third_place}</p>
                </div>
                <button onClick={onRerun} disabled={isFetching}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-collapse-border text-collapse-muted hover:text-collapse-text hover:border-collapse-accent text-xs font-semibold transition-all">
                  <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}/>
                  Re-run
                </button>
              </div>
            </div>
          </motion.div>

          {/* Top risk matches */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400"/>
              <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider">Highest Collapse Risk Matches</p>
            </div>
            <div className="space-y-1.5">
              {tourn.top_risk_matches.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[9px] text-collapse-dim w-3 shrink-0">#{i+1}</span>
                  <MatchRow m={m} onClick={() => handleMatchClick(m, 'High risk')}/>
                </div>
              ))}
            </div>
          </div>

          {/* Process stepper: show group stage → knockouts step-by-step */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">View stage</p>
            <div className="flex rounded-xl overflow-hidden border border-collapse-border text-[10px] font-bold">
              {(['groups', 'r16', 'qf', 'sf', 'final'] as const).map(phase => (
                <button
                  key={phase}
                  onClick={() => setRevealPhase(phase)}
                  className={`flex items-center gap-1 px-2.5 py-2 transition-all capitalize ${revealPhase === phase ? 'bg-amber-500 text-black' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'}`}
                >
                  {phase === 'groups' && 'Groups'}
                  {phase === 'r16' && 'R16'}
                  {phase === 'qf' && 'QF'}
                  {phase === 'sf' && 'SF'}
                  {phase === 'final' && 'Final'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
            {/* Groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider">Group Stage</p>
                <div className="flex rounded-lg overflow-hidden border border-collapse-border text-[10px] font-bold">
                  {'ABCDEFGH'.split('').map(g => (
                    <button key={g} onClick={() => setActiveGroup(g)}
                      className={`px-2.5 py-1.5 transition-all ${activeGroup === g ? 'bg-collapse-accent text-white' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={activeGroup} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}>
                  <GroupTableWithMatchdays
                    name={activeGroup}
                    standings={tourn.groups[activeGroup].standings}
                    matches={tourn.groups[activeGroup].matches}
                    onTeamClick={handleTeamClick}
                    onMatchClick={handleMatchClick}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Knockout bracket — reveal by phase */}
            <div className="space-y-4 bg-collapse-surface border border-collapse-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider">Knockout Bracket</p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setRevealPhase(p => p === 'groups' ? 'groups' : p === 'r16' ? 'groups' : p === 'qf' ? 'r16' : p === 'sf' ? 'qf' : 'sf')}
                    className="p-1.5 rounded-lg border border-collapse-border text-collapse-muted hover:text-collapse-text hover:border-collapse-accent transition-colors" title="Previous stage">
                    <ChevronLeft className="w-3.5 h-3.5"/>
                  </button>
                  <button type="button" onClick={() => setRevealPhase(p => p === 'final' ? 'final' : p === 'groups' ? 'r16' : p === 'r16' ? 'qf' : p === 'qf' ? 'sf' : 'final')}
                    className="p-1.5 rounded-lg border border-collapse-border text-collapse-muted hover:text-collapse-text hover:border-collapse-accent transition-colors" title="Next stage">
                    <ChevronRight className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>
              <KnockoutStage label="Round of 16"  matches={tourn.knockout.r16}  visible={revealPhase !== 'groups'} onMatchClick={handleMatchClick}/>
              <KnockoutStage label="Quarter-finals" matches={tourn.knockout.qf}  visible={revealPhase === 'qf' || revealPhase === 'sf' || revealPhase === 'final'} onMatchClick={handleMatchClick}/>
              <KnockoutStage label="Semi-finals"  matches={tourn.knockout.sf}   visible={revealPhase === 'sf' || revealPhase === 'final'} onMatchClick={handleMatchClick}/>
              <KnockoutStage label="3rd Place"    matches={tourn.knockout.third_place} visible={revealPhase === 'final'} onMatchClick={handleMatchClick}/>
              {(revealPhase === 'final') && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-2 space-y-1">
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Final</p>
                  {tourn.knockout.final.map((m, i) => <MatchRow key={i} m={m} onClick={() => handleMatchClick(m, 'Final')}/>)}
                </motion.div>
              )}
            </div>
          </div>

          {/* Teams rounds reached — click team for performance */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
            <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider mb-3">All Teams · How Far They Got (click for details)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {Object.entries(tourn.rounds_reached)
                .sort((a, b) => {
                  const order = ['Champion 🏆','Runner-up','3rd place','SF exit','SF','QF','R16','Group stage'];
                  return (order.indexOf(a[1]) ?? 8) - (order.indexOf(b[1]) ?? 8);
                })
                .map(([team, round]) => (
                  <div
                    key={team}
                    onClick={() => handleTeamClick(team)}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 border text-xs cursor-pointer hover:ring-2 hover:ring-collapse-accent/40 transition-all ${
                      round.includes('Champion') ? 'bg-amber-500/10 border-amber-500/25' :
                      round.includes('Runner')   ? 'bg-slate-500/10 border-slate-500/20' :
                      round.includes('3rd')      ? 'bg-orange-500/10 border-orange-500/20' :
                      'bg-collapse-bg border-collapse-border'
                    }`}
                  >
                    <span className="font-semibold text-collapse-text truncate">{team}</span>
                    <span className={`text-[9px] shrink-0 ${
                      round.includes('Champion') ? 'text-amber-400' :
                      round.includes('Runner')   ? 'text-slate-400' :
                      round.includes('3rd')      ? 'text-orange-400' :
                      'text-collapse-dim'
                    }`}>{round}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Modals: match detail & team performance */}
          <AnimatePresence>
            {selectedMatch && (
              <MatchDetailModal
                match={selectedMatch}
                stage={selectedMatchStage}
                onClose={() => setSelectedMatch(null)}
              />
            )}
            {selectedTeam && tourn && (
              <TeamDetailModal
                team={selectedTeam}
                tourn={tourn}
                onClose={() => setSelectedTeam(null)}
                onMatchClick={(m, stage) => { setSelectedTeam(null); handleMatchClick(m, stage); }}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── WC 2026 teams ──────────────────────────────────────────────────────────
const WC2026_TEAMS = [
  'Argentina','Australia','Belgium','Brazil','Cameroon','Canada',
  'Croatia','Denmark','Ecuador','England','France','Germany',
  'Ghana','Iran','Japan','Mexico','Morocco','Netherlands',
  'Poland','Portugal','Qatar','Saudi Arabia','Senegal','Serbia',
  'South Korea','Spain','Switzerland','Tunisia','USA','Uruguay','Wales',
];

// ── Main component ─────────────────────────────────────────────────────────
export function LiveSim() {
  const [mode, setMode] = useState<'match' | 'tournament'>('match');
  const [teamA, setTeamA]   = useState('France');
  const [teamB, setTeamB]   = useState('Brazil');
  const [running, setRunning] = useState(false);
  const [currentMin, setCurrentMin] = useState(0);
  const [speed, setSpeed]   = useState<Speed>(1);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: sim, isLoading, refetch } = useQuery<SimData>({
    queryKey: ['live-sim', teamA, teamB],
    queryFn: () => get(`/api/wc2026/live-sim?team_a=${encodeURIComponent(teamA)}&team_b=${encodeURIComponent(teamB)}`),
    enabled: false,
  });

  // Start simulation
  const startSim = useCallback(() => {
    if (!sim) return;
    setCurrentMin(0);
    setStarted(true);
    setRunning(true);
  }, [sim]);

  // Tick
  useEffect(() => {
    if (!running || !sim) return;
    const ms = Math.round(1000 / speed);
    intervalRef.current = setInterval(() => {
      setCurrentMin(prev => {
        if (prev >= 90) { setRunning(false); return 90; }
        return prev + 1;
      });
    }, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, speed, sim]);

  // Pause at 90
  useEffect(() => { if (currentMin >= 90) setRunning(false); }, [currentMin]);

  // Load simulation on team change
  const handleLoad = () => {
    setStarted(false);
    setCurrentMin(0);
    setRunning(false);
    refetch();
  };

  const reset = () => {
    setRunning(false);
    setCurrentMin(0);
    setStarted(false);
  };

  // Visible data (up to current minute)
  const visibleMinutes: MinuteData[] = sim
    ? sim.minutes.slice(0, Math.max(1, currentMin))
    : [];

  const currentData = visibleMinutes[visibleMinutes.length - 1];
  const scoreA = currentData?.score_a ?? 0;
  const scoreB = currentData?.score_b ?? 0;

  // Events up to current minute (reverse for feed)
  const visibleEvents = sim
    ? [...sim.events]
        .filter(e => e.minute <= currentMin && e.type !== 'fulltime')
        .reverse()
        .slice(0, 12)
    : [];

  const isFulltime = currentMin >= 90;

  return (
    <div className="h-full flex flex-col bg-collapse-bg text-collapse-text overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-0 border-b border-collapse-border bg-collapse-surface">
        <div className="flex items-center justify-between mb-4">
          {/* Mode tabs */}
          <div className="flex rounded-xl overflow-hidden border border-collapse-border text-xs font-bold">
            <button onClick={() => setMode('match')}
              className={`flex items-center gap-1.5 px-4 py-2 transition-all ${mode === 'match' ? 'bg-collapse-accent text-white' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'}`}>
              <Radio className="w-3.5 h-3.5"/>Match Sim
            </button>
            <button onClick={() => setMode('tournament')}
              className={`flex items-center gap-1.5 px-4 py-2 transition-all ${mode === 'tournament' ? 'bg-amber-500 text-black' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'}`}>
              <Trophy className="w-3.5 h-3.5"/>Tournament
            </button>
          </div>
        </div>
        {mode === 'tournament' && (
          <div className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-400"/>
              </div>
              <div>
                <p className="text-sm font-bold text-collapse-text">WC 2026 Tournament Simulation</p>
                <p className="text-[10px] text-collapse-muted">Full bracket · Group stage → Final · Collapse risk per match</p>
              </div>
            </div>
          </div>
        )}
        {mode === 'match' && (
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Zap className="w-5 h-5 text-white"/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Live Simulation</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide bg-purple-500/10 text-purple-400 border-purple-500/20">WC 2026</span>
                {running && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-collapse-muted">Collapse probability · Sentiment · Psychological pressure · Real-time</p>
            </div>
          </div>

          {/* Team pickers + load */}
          <div className="flex items-end gap-3">
            <TeamSelect value={teamA} onChange={setTeamA} options={WC2026_TEAMS} label="Team A"/>
            <span className="text-collapse-muted text-lg font-bold mb-2">vs</span>
            <TeamSelect value={teamB} onChange={v => v !== teamA ? setTeamB(v) : null} options={WC2026_TEAMS.filter(t => t !== teamA)} label="Team B"/>
            <button onClick={handleLoad} disabled={isLoading}
              className="mb-0.5 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-collapse-accent text-white text-sm font-bold hover:bg-collapse-accent/80 transition-all disabled:opacity-50">
              {isLoading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : <Zap className="w-4 h-4"/>}
              {isLoading ? 'Loading…' : 'Load Match'}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Tournament mode */}
      {mode === 'tournament' && <TournamentSim/>}

      {/* Match mode body */}
      {mode === 'match' && (
      <>
      {!sim && !isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 flex items-center justify-center">
            <Zap className="w-9 h-9 text-red-400"/>
          </div>
          <div>
            <p className="text-lg font-bold text-collapse-text mb-1">WC 2026 Live Simulation</p>
            <p className="text-sm text-collapse-muted max-w-md">
              Pick two teams and click Load Match to generate a full 90-minute simulation with real-time collapse probability, crowd sentiment, and psychological pressure tracking.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-collapse-muted text-sm">
          <span className="w-5 h-5 border-2 border-collapse-border border-t-collapse-accent rounded-full animate-spin"/>
          Generating match simulation…
        </div>
      ) : sim && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Score bar + controls */}
          <div className="shrink-0 px-8 py-4 border-b border-collapse-border bg-collapse-surface/50 flex items-center justify-between">
            {/* Score */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">{sim.team_a}</p>
                <p className="text-4xl font-black font-mono text-collapse-text leading-none mt-0.5">{scoreA}</p>
              </div>
              <div className="text-center space-y-1">
                <div className="text-xl font-black text-collapse-muted">–</div>
                <div className="text-[10px] font-bold font-mono text-collapse-muted">{started ? `${currentMin}'` : '0\''}</div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">{sim.team_b}</p>
                <p className="text-4xl font-black font-mono text-collapse-text leading-none mt-0.5">{scoreB}</p>
              </div>
              {isFulltime && (
                <span className="ml-4 text-xs font-bold px-3 py-1.5 rounded-full bg-collapse-border text-collapse-muted">FULL TIME</span>
              )}
            </div>

            {/* Rivalry badge */}
            <div className="hidden md:flex items-center gap-2 bg-collapse-surface border border-collapse-border rounded-xl px-3 py-2">
              <Heart className="w-3.5 h-3.5 text-red-400"/>
              <span className="text-[10px] font-bold text-collapse-muted">Rivalry</span>
              <span className="text-sm font-black font-mono text-red-400">{pct(sim.rivalry_index)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Speed */}
              <div className="flex rounded-lg overflow-hidden border border-collapse-border text-[10px] font-bold">
                {SPEED_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`px-2.5 py-1.5 transition-all ${speed === s ? 'bg-collapse-accent text-white' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'}`}>
                    {s}×
                  </button>
                ))}
              </div>
              {/* Play/Pause */}
              <button onClick={() => started ? setRunning(r => !r) : startSim()}
                disabled={isFulltime && started}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-collapse-accent text-white text-sm font-bold hover:bg-collapse-accent/80 transition-all disabled:opacity-40">
                {running ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                {running ? 'Pause' : started ? 'Resume' : 'Start'}
              </button>
              {/* Reset */}
              <button onClick={reset}
                className="p-2 rounded-xl border border-collapse-border text-collapse-muted hover:text-collapse-text hover:border-collapse-accent transition-all">
                <RotateCcw className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* Main grid */}
          <div className="flex-1 overflow-hidden grid grid-cols-[1fr_320px] min-h-0">
            {/* Left — chart + event feed */}
            <div className="flex flex-col min-h-0 border-r border-collapse-border">
              {/* Collapse probability chart */}
              <div className="shrink-0 p-6 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-collapse-text">Collapse Probability — {sim.team_a}</p>
                    <p className="text-[10px] text-collapse-muted mt-0.5">
                      Logistic model · 5 psychological features · rivalry-weighted
                    </p>
                  </div>
                  {currentData && (
                    <div className="text-right">
                      <p className="text-2xl font-black font-mono" style={{ color: riskColor(currentData.collapse_prob) }}>
                        {pct(currentData.collapse_prob)}
                      </p>
                      <p className="text-[10px] text-collapse-muted">current risk</p>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={visibleMinutes} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                      </linearGradient>
                      <linearGradient id="momGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.06)" vertical={false}/>
                    <XAxis dataKey="minute" tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}'`}/>
                    <YAxis tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={v => `${Math.round(v*100)}%`}/>
                    <Tooltip content={<LiveTooltip/>}/>
                    <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1}
                      label={{ value: '50% threshold', fill: '#f59e0b', fontSize: 8, position: 'insideTopLeft' }}/>
                    {/* Mark goal events */}
                    {sim.events.filter(e => e.type === 'goal' && e.minute <= currentMin).map((e, i) => (
                      <ReferenceLine key={i} x={e.minute} stroke={e.team === sim.team_a ? '#22c55e' : '#ef4444'}
                        strokeDasharray="3 2" strokeWidth={1.5}
                        label={{ value: e.team === sim.team_a ? '⚽A' : '⚽B', fill: e.team === sim.team_a ? '#22c55e' : '#ef4444', fontSize: 8 }}/>
                    ))}
                    <Area type="monotone" dataKey="momentum" stroke="#22c55e" strokeWidth={1}
                      fill="url(#momGrad)" dot={false} name="Momentum"/>
                    <Area type="monotone" dataKey="collapse_prob" stroke="#ef4444" strokeWidth={2}
                      fill="url(#riskGrad)" dot={false} name="Collapse Risk" isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Sentiment overlay chart */}
              <div className="shrink-0 px-6 pb-2">
                <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider mb-2">Crowd Sentiment & Psychological Pressure</p>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={visibleMinutes} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="crowdGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02}/>
                      </linearGradient>
                      <linearGradient id="psychGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="minute" tick={{ fill: '#64748B', fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}'`}/>
                    <YAxis hide domain={[0, 1]}/>
                    <Tooltip contentStyle={{ background: 'rgba(10,18,40,0.97)', border: '1px solid #1C2D40', borderRadius: 8, fontSize: 10 }}
                      formatter={(v: number, name: string) => [pct(v), name]}/>
                    <Area type="monotone" dataKey="crowd_pressure"       stroke="#0ea5e9" strokeWidth={1.5} fill="url(#crowdGrad)" dot={false} name="Crowd Pressure" isAnimationActive={false}/>
                    <Area type="monotone" dataKey="psychological_stress" stroke="#a855f7" strokeWidth={1.5} fill="url(#psychGrad)" dot={false} name="Psych Stress" isAnimationActive={false}/>
                    <Area type="monotone" dataKey="physical_fatigue"     stroke="#f59e0b" strokeWidth={1}   fill="none" strokeDasharray="3 2" dot={false} name="Fatigue" isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-1">
                  {[['#0ea5e9','Crowd Pressure'],['#a855f7','Psych Stress'],['#f59e0b','Fatigue']].map(([c,l]) => (
                    <span key={l} className="flex items-center gap-1 text-[9px] text-collapse-dim">
                      <span className="w-3 h-0.5 rounded inline-block" style={{ background: c }}/>
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Event feed */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-4">
                <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider mb-3 sticky top-0 bg-collapse-bg py-1">Event Feed</p>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {visibleEvents.map((ev, i) => (
                      <motion.div key={`${ev.minute}-${ev.type}-${i}`}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex gap-3 rounded-xl px-3 py-2.5 border ${
                          ev.type === 'goal'          ? 'bg-emerald-500/5 border-emerald-500/20' :
                          ev.type === 'momentum_shift'? 'bg-amber-500/5 border-amber-500/20' :
                          ev.type === 'card'          ? 'bg-yellow-500/5 border-yellow-500/20' :
                          'bg-collapse-surface border-collapse-border'
                        }`}>
                        <span className="text-sm leading-none mt-0.5 shrink-0">{eventIcon(ev.type)}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-collapse-muted">{ev.minute}'
                            {ev.type === 'goal' && ev.team && <span className="ml-1 text-emerald-400">{ev.team}{ev.score_a !== undefined ? ` — ${ev.score_a}–${ev.score_b}` : ''}</span>}
                            {ev.type === 'substitution' && ev.team && <span className="ml-1 text-collapse-accent">{ev.team}</span>}
                          </p>
                          <p className="text-xs text-collapse-text mt-0.5 leading-snug">
                            {ev.type === 'goal' && ev.player && <span className="font-semibold">{ev.player} · </span>}
                            {ev.type === 'substitution' && ev.player_off && <span>↓ {ev.player_off} · ↑ {ev.player_on} · </span>}
                            {ev.description}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {!started && (
                    <div className="text-center py-8 text-collapse-dim text-xs">
                      Press Start to begin the simulation
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right — psychological dashboard */}
            <div className="overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted mb-4">Psychological Dashboard</p>

                {currentData ? (
                  <div className="space-y-5">
                    <PsychBar label="Crowd Pressure"       value={currentData.crowd_pressure}
                      icon={Users}  color="#0ea5e9"
                      description="Crowd noise, venue atmosphere & score-state sentiment"/>
                    <PsychBar label="Momentum"             value={currentData.momentum}
                      icon={Zap}    color="#22c55e"
                      description="Territory control + recent shot volume + goal recency"/>
                    <PsychBar label="Psychological Stress" value={currentData.psychological_stress}
                      icon={Brain}  color="#a855f7"
                      description="Score deficit × time pressure × tempo variance"/>
                    <PsychBar label="Physical Fatigue"     value={currentData.physical_fatigue}
                      icon={Flame}  color="#f59e0b"
                      description="Cumulative exertion · dips on substitutions"/>
                    <PsychBar label="Rivalry Intensity"    value={currentData.rivalry_index}
                      icon={Heart}  color="#ef4444"
                      description="Historical head-to-head psychological weight"/>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {['Crowd Pressure','Momentum','Psychological Stress','Physical Fatigue','Rivalry Intensity'].map(l => (
                      <div key={l} className="space-y-1.5">
                        <div className="h-3 bg-collapse-border rounded w-32 animate-pulse"/>
                        <div className="h-2 bg-collapse-border/50 rounded-full animate-pulse"/>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Turnover + territory indicators */}
              {currentData && (
                <div className="space-y-3 border-t border-collapse-border pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-collapse-muted">Tactical Signals</p>
                  {[
                    { label: 'Turnover Burstiness', val: currentData.turnover_burstiness, color: currentData.turnover_burstiness > 0.4 ? '#ef4444' : '#22c55e' },
                    { label: 'Territory Tilt',      val: currentData.territory_tilt,      color: currentData.territory_tilt > 0.55 ? '#ef4444' : '#22c55e' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-collapse-muted">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-collapse-border overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, val * 100)}%`, background: color }}/>
                        </div>
                        <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color }}>{pct(val)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Final score preview */}
              {isFulltime && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="border-t border-collapse-border pt-4 space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-amber-400"/>
                    <p className="text-xs font-bold text-collapse-text">Full Time</p>
                  </div>
                  <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-4 text-center">
                    <p className="text-3xl font-black font-mono text-collapse-text">
                      {sim.final_score.team_a} – {sim.final_score.team_b}
                    </p>
                    <p className="text-xs text-collapse-muted mt-1">
                      {sim.team_a} vs {sim.team_b}
                    </p>
                    <p className="text-[10px] text-collapse-dim mt-2">
                      {sim.final_score.team_a === sim.final_score.team_b
                        ? 'Draw'
                        : sim.final_score.team_a > sim.final_score.team_b
                          ? `${sim.team_a} win`
                          : `${sim.team_b} win`}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
