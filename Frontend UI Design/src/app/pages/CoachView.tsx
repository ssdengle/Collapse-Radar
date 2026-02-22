import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BrainCircuit, Target, Swords, Film, ChevronDown, AlertTriangle,
  TrendingDown, Database, FlaskConical, ChevronRight, Info, Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { API_BASE } from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
type Tournament = 'wc2022' | 'wc2026';
type Page = 'home' | 'scout' | 'matchup' | 'replay';
type PressLevel = 25 | 50 | 75;
type BuildStyle  = 25 | 50 | 75;
type TempoCtrl   = 25 | 50 | 75;

interface TeamHome {
  team: string; style_tags: string[]; collapse_window: string;
  top_triggers: string[]; stabilizers: string[];
  fingerprint: Record<string, number>;
  limited_prior?: boolean; data_source?: string; has_real_data?: boolean;
}
interface MatchupHero {
  team_a: string; team_b: string;
  win_range: { low: number; high: number };
  collapse_range: { low: number; high: number };
  collapse_window: string; top_triggers: string[];
  levers: { action: string; delta: number }[];
  dont_do: string; insights: Insight[];
}
interface Insight {
  headline: string; stat: string; proof_type: 'before_after' | 'heatmap' | 'mini_timeline';
  proof: any;
}

const get = (path: string) => fetch(`${API_BASE}${path}`).then(r => r.json());

// ── Custom dropdown ────────────────────────────────────────────────────────
function Dropdown({
  options, value, onChange, placeholder = 'Select…', accent = '#0EA5E9', disabled = false,
}: { options: string[]; value: string; onChange: (v: string) => void; placeholder?: string; accent?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative min-w-[185px]">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium text-left transition-all
          ${open ? 'border-[var(--dd-accent)] bg-collapse-bg' : 'border-collapse-border bg-collapse-surface hover:border-collapse-muted'}
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ '--dd-accent': accent } as any}>
        <span className={value ? 'text-collapse-text' : 'text-collapse-muted'}>{value || placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronDown className="w-4 h-4 text-collapse-muted shrink-0"/>
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 left-0 right-0 bg-collapse-surface border border-collapse-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
            {options.map(opt => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-collapse-bg
                  ${value === opt ? 'font-semibold' : 'text-collapse-text'}`}
                style={{ color: value === opt ? accent : undefined }}>
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tournament picker ──────────────────────────────────────────────────────
function TournamentPicker({ value, onChange }: { value: Tournament; onChange: (v: Tournament) => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-collapse-border text-xs font-semibold">
      {([['wc2022', 'WC 2022'] , ['wc2026', 'WC 2026 Sim']] as [Tournament, string][]).map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`px-4 py-2 transition-all flex items-center gap-1.5 ${
            value === id ? 'bg-collapse-accent text-white' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'
          }`}>
          {id === 'wc2026' && <FlaskConical className="w-3 h-3"/>}
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Data source badge ──────────────────────────────────────────────────────
function DataBadge({ source, hasRealData }: { source?: string; hasRealData?: boolean }) {
  if (!source) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
      hasRealData
        ? 'bg-collapse-safe/8 border-collapse-safe/25 text-collapse-safe'
        : 'bg-collapse-warn/8 border-collapse-warn/25 text-collapse-warn'
    }`}>
      {hasRealData ? <Database className="w-3 h-3"/> : <FlaskConical className="w-3 h-3"/>}
      {source}
    </span>
  );
}

// ── WC 2026 simulation banner ──────────────────────────────────────────────
function SimBanner() {
  return (
    <div className="flex items-start gap-3 bg-collapse-warn/5 border border-collapse-warn/25 rounded-xl px-4 py-3">
      <FlaskConical className="w-4 h-4 text-collapse-warn shrink-0 mt-0.5"/>
      <div>
        <p className="text-xs font-bold text-collapse-warn">WC 2026 Simulation Mode</p>
        <p className="text-xs text-collapse-muted mt-0.5 leading-relaxed">
          No 2026 match data exists yet. Outputs are simulated using WC 2022 event data as priors — teams with exact name matches use real fingerprints, others use region-based estimates. Treat as planning tool, not prediction.
        </p>
      </div>
    </div>
  );
}

// ── Fingerprint bar chart ──────────────────────────────────────────────────
const FP_LABELS: Record<string, string> = {
  pass_acc_slope: 'Pass Decay', turnover_pm: 'Turnovers', burstiness: 'Burst',
  def_actions_pm: 'Def Load', ft_entries_pm: 'Attacking', shots_conc_pm: 'Shots Conceded',
  tempo_variance: 'Tempo Chaos', territory_tilt: 'Territory',
};

function FingerprintChart({ fp, avg, teamName }: { fp: Record<string, number>; avg?: Record<string, number>; teamName: string }) {
  const data = Object.keys(FP_LABELS).map(k => ({
    key: k, label: FP_LABELS[k],
    team:  Math.round((fp[k]  ?? 0) * 100),
    avg:   Math.round((avg?.[k] ?? 0) * 100),
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-[10px] font-semibold text-collapse-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block bg-collapse-accent"/>{teamName}</span>
        {avg && <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block bg-collapse-border"/>{' '}Tournament avg</span>}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 4, left: -12, bottom: 0 }} barGap={2}>
          <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false}/>
          <YAxis tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 60]}/>
          <Tooltip
            contentStyle={{ background: '#0F1929', border: '1px solid #1C2D40', borderRadius: 6, fontSize: 10 }}
            formatter={(v: number, name: string) => [`${v}`, name === 'team' ? teamName : 'WC avg']}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}/>
          {avg && <Bar dataKey="avg" fill="#1C2D40" radius={[2, 2, 0, 0]} maxBarSize={14}/>}
          <Bar dataKey="team" fill="#0EA5E9" radius={[2, 2, 0, 0]} maxBarSize={14}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.team > (avg?.[d.key] ? Math.round(avg[d.key] * 100) : 25) ? '#FF3B5C' : '#0EA5E9'}/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-collapse-dim mt-1">Red = above tournament avg · Blue = below · Higher is not always worse — depends on the metric</p>
    </div>
  );
}

// ── Proof panels ───────────────────────────────────────────────────────────
function BeforeAfter({ proof }: { proof: any }) {
  return (
    <div className="space-y-3 pt-2">
      {[{ label: proof.label_a, val: proof.value_a }, { label: proof.label_b, val: proof.value_b }].map(({ label, val }) => (
        <div key={label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-collapse-muted">{label}</span>
            <span className="font-mono font-bold text-collapse-text">{val}% {proof.unit.replace('%', '').trim()}</span>
          </div>
          <div className="h-3 bg-collapse-bg rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: val > 65 ? '#0BDE8C' : '#FF3B5C' }}
              initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.7 }}/>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-collapse-dim pt-1">
        Delta: <span className="font-bold text-collapse-warn">{Math.abs(proof.value_b - proof.value_a).toFixed(0)} pp worse</span> against high-press teams
      </p>
    </div>
  );
}

function PitchHeatmap({ proof }: { proof: any }) {
  const maxW    = Math.max(...proof.zones.map((z: any) => z.w), 0.01);
  const sorted  = [...proof.zones].sort((a: any, b: any) => b.w - a.w);
  const hottest = sorted[0];

  // Pitch viewBox: 240 × 160
  const VW = 240; const VH = 160;
  const px = (x: number) => (x / 100) * VW;
  const py = (y: number) => (y / 100) * VH;

  const zoneColor = (intensity: number) =>
    intensity > 0.75 ? '#FF3B5C' : intensity > 0.45 ? '#F5A623' : '#0EA5E9';

  const zoneTactical: Record<string, string> = {
    Central: 'high turnover rate in central areas — transition danger',
    Left:    'left flank overloaded — vulnerable to switches',
    Right:   'right flank overloaded — vulnerable to switches',
    Deep:    'defensive turnovers deep — direct concession risk',
  };

  return (
    <div className="pt-3 space-y-3">
      {/* Hottest zone callout */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg border"
        style={{ background: `${zoneColor(hottest.w / maxW)}10`, borderColor: `${zoneColor(hottest.w / maxW)}30` }}>
        <span className="text-lg leading-none mt-0.5">🔥</span>
        <div>
          <p className="text-xs font-semibold" style={{ color: zoneColor(hottest.w / maxW) }}>
            Hottest zone: {hottest.label}
          </p>
          <p className="text-[10px] text-collapse-muted leading-relaxed">
            {zoneTactical[hottest.label] ?? 'elevated turnover clustering in this zone'}
          </p>
        </div>
      </div>

      {/* Pitch SVG */}
      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-1/2 mx-auto block rounded-xl overflow-hidden">
        {/* Pitch background */}
        <rect width={VW} height={VH} fill="#0B1622" rx="6"/>
        {/* Subtle grass stripes */}
        {[0,1,2,3,4,5].map(i => (
          <rect key={i} x={i * 40} y={0} width={40} height={VH}
            fill={i % 2 === 0 ? '#0E1D2E' : '#0B1622'} opacity={0.5}/>
        ))}
        {/* Pitch outline */}
        <rect x="8" y="8" width={VW-16} height={VH-16} fill="none" stroke="#1C2D40" strokeWidth="1.5" rx="2"/>
        {/* Halfway line */}
        <line x1={VW/2} y1="8" x2={VW/2} y2={VH-8} stroke="#1C2D40" strokeWidth="1"/>
        {/* Centre circle */}
        <circle cx={VW/2} cy={VH/2} r="22" fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {/* Centre spot */}
        <circle cx={VW/2} cy={VH/2} r="2" fill="#1C2D40"/>
        {/* Left penalty area */}
        <rect x="8" y={py(28)} width={px(18)} height={py(44)} fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {/* Left goal box */}
        <rect x="8" y={py(38)} width={px(8)} height={py(24)} fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {/* Left penalty spot */}
        <circle cx={px(12)} cy={VH/2} r="1.5" fill="#1C2D40"/>
        {/* Right penalty area */}
        <rect x={VW - 8 - px(18)} y={py(28)} width={px(18)} height={py(44)} fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {/* Right goal box */}
        <rect x={VW - 8 - px(8)} y={py(38)} width={px(8)} height={py(24)} fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {/* Right penalty spot */}
        <circle cx={VW - px(12)} cy={VH/2} r="1.5" fill="#1C2D40"/>
        {/* Corner arcs */}
        {[[8,8],[VW-8,8],[8,VH-8],[VW-8,VH-8]].map(([cx, cy], i) => (
          <path key={i} d={`M ${cx + (i%2===0?4:-4)} ${cy} A 6 6 0 0 ${i<2?1:0} ${cx} ${cy + (i<2?4:-4)}`}
            fill="none" stroke="#1C2D40" strokeWidth="1"/>
        ))}

        {/* Zone bubbles */}
        {proof.zones.map((z: any) => {
          const intensity = z.w / maxW;
          const cx = px(z.x);
          const cy = py(z.y);
          const r  = 8 + intensity * 20;
          const col = zoneColor(intensity);
          return (
            <g key={z.label}>
              {/* Outer glow ring */}
              <circle cx={cx} cy={cy} r={r + 6} fill={col} opacity={0.06}/>
              {/* Main blob */}
              <circle cx={cx} cy={cy} r={r} fill={col} opacity={0.18 + intensity * 0.32}/>
              {/* Core dot */}
              <circle cx={cx} cy={cy} r={4} fill={col} opacity={0.9}/>
              {/* Zone label */}
              <text x={cx} y={cy - r - 4} textAnchor="middle" fill={col}
                fontSize="7" fontWeight="600" opacity={0.9}>{z.label}</text>
              {/* Intensity % */}
              <text x={cx} y={cy + r + 9} textAnchor="middle" fill={col}
                fontSize="6.5" opacity={0.7}>{Math.round(z.w * 100)}%</text>
            </g>
          );
        })}

        {/* Direction arrow hint */}
        <text x={VW/2} y={VH - 3} textAnchor="middle" fill="#1C2D40" fontSize="7">← attacking direction →</text>
      </svg>

      {/* Zone breakdown */}
      <div className="space-y-1.5">
        {sorted.map((z: any) => {
          const intensity = z.w / maxW;
          const col = zoneColor(intensity);
          return (
            <div key={z.label} className="flex items-center gap-3">
              <span className="text-[10px] text-collapse-muted w-14 shrink-0">{z.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-collapse-border overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${intensity * 100}%`, background: col }}/>
              </div>
              <span className="text-[10px] font-mono font-semibold w-8 text-right" style={{ color: col }}>
                {Math.round(z.w * 100)}%
              </span>
              <span className="text-[9px] text-collapse-dim w-10 text-right">
                {intensity > 0.75 ? 'HIGH' : intensity > 0.45 ? 'MED' : 'LOW'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-collapse-muted">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>HIGH (&gt;75%)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>MED (45–75%)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>LOW (&lt;45%)</span>
      </div>
    </div>
  );
}

function MiniTimeline({ proof }: { proof: any }) {
  const pts = proof.def_load.map((d: number, i: number) => ({
    min: i,
    def: Math.round(Math.min(d * 100, 100)),
    prob: Math.round(Math.min(proof.probability[i] * 100, 100)),
  }));
  const onsetPct = pts.length > 1 ? Math.round((proof.onset / (pts.length - 1)) * 100) : 50;
  const onsetMin = pts[proof.onset]?.min ?? proof.onset;
  const peakDef  = Math.max(...pts.map((p: any) => p.def));
  const peakProb = Math.max(...pts.map((p: any) => p.prob));

  return (
    <div className="pt-3 space-y-3">
      {/* Context row */}
      <div className="flex gap-3">
        <div className="flex-1 bg-collapse-surface rounded-lg px-3 py-2 border border-collapse-border">
          <p className="text-[10px] text-collapse-muted">Def load at onset</p>
          <p className="text-sm font-bold font-mono text-collapse-accent">{pts[proof.onset]?.def ?? '—'}%</p>
          <p className="text-[10px] text-collapse-dim">of max {peakDef}%</p>
        </div>
        <div className="flex-1 bg-collapse-surface rounded-lg px-3 py-2 border border-collapse-border">
          <p className="text-[10px] text-collapse-muted">Risk at onset</p>
          <p className="text-sm font-bold font-mono text-collapse-risk">{pts[proof.onset]?.prob ?? '—'}%</p>
          <p className="text-[10px] text-collapse-dim">peak {peakProb}%</p>
        </div>
        <div className="flex-1 bg-collapse-surface rounded-lg px-3 py-2 border border-collapse-border">
          <p className="text-[10px] text-collapse-muted">Onset at</p>
          <p className="text-sm font-bold font-mono text-amber-400">min {onsetMin}</p>
          <p className="text-[10px] text-collapse-dim">{onsetPct}% into match</p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={pts} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="defGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0EA5E9" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.02}/>
              </linearGradient>
              <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FF3B5C" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#FF3B5C" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="min" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}'`} interval={Math.floor(pts.length / 4)}/>
            <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}/>
            <Tooltip
              contentStyle={{ background: '#0F1929', border: '1px solid #1C2D40', borderRadius: 8, fontSize: 10 }}
              labelStyle={{ color: '#94A3B8' }} labelFormatter={l => `Min ${l}`}
              formatter={(v: number, name: string) => [`${v}%`, name === 'def' ? 'Defensive Load' : 'Collapse Risk']}
              itemStyle={{ padding: '1px 0' }}/>
            <ReferenceLine x={onsetMin} stroke="#F5A623" strokeWidth={2} strokeDasharray="4 3"
              label={{ value: '⚡ onset', fill: '#F5A623', fontSize: 9, position: 'insideTopRight' }}/>
            <Area type="monotone" dataKey="def"  stroke="#0EA5E9" strokeWidth={2} fill="url(#defGrad)"  dot={false} name="def"/>
            <Area type="monotone" dataKey="prob" stroke="#FF3B5C" strokeWidth={2} fill="url(#probGrad)" dot={false} name="prob"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + reading guide */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4 text-[10px] text-collapse-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-collapse-accent inline-block rounded"/>
            Defensive Load
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-collapse-risk inline-block rounded"/>
            Collapse Risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-400 inline-block rounded" style={{ borderBottom: '2px dashed' }}/>
            Onset
          </span>
        </div>
        <p className="text-[10px] text-collapse-dim text-right max-w-[180px] leading-relaxed">
          When def load stays high and risk crosses it — collapse has begun.
        </p>
      </div>
    </div>
  );
}

// ── Insight card (click to expand proof) ──────────────────────────────────
function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-collapse-surface border border-collapse-border rounded-2xl overflow-hidden">
      <button className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-collapse-bg/50 transition-colors" onClick={() => setOpen(o => !o)}>
        <span className="w-6 h-6 rounded-full bg-collapse-warn/15 text-collapse-warn text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{index+1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-collapse-text leading-snug">{insight.headline}</p>
          <p className="text-xs text-collapse-muted mt-0.5">{insight.stat}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-collapse-dim border border-collapse-border rounded px-2 py-0.5">{open ? 'hide' : 'see proof'}</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-collapse-muted"/>
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-collapse-border bg-collapse-bg/60 px-5 pb-4">
            {insight.proof_type === 'before_after'  && <BeforeAfter proof={insight.proof}/>}
            {insight.proof_type === 'heatmap'       && <PitchHeatmap proof={insight.proof}/>}
            {insight.proof_type === 'mini_timeline' && <MiniTimeline proof={insight.proof}/>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Lever button group ─────────────────────────────────────────────────────
function LeverGroup<T extends number>({ label, tooltip, opts, value, onChange }: {
  label: string; tooltip: string; opts: [T, string][]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-collapse-muted font-bold uppercase tracking-wider">
        {label}
        <span title={tooltip}><Info className="w-3 h-3 text-collapse-dim cursor-help"/></span>
      </div>
      <div className="flex rounded-lg overflow-hidden border border-collapse-border">
        {opts.map(([val, lbl]) => (
          <button key={val} onClick={() => onChange(val)}
            className={`flex-1 py-2 text-xs font-medium transition-all ${value === val ? 'bg-collapse-accent text-white' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'}`}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── StyleTag ───────────────────────────────────────────────────────────────
function StyleTag({ tag }: { tag: string }) {
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-collapse-accent/10 border border-collapse-accent/25 text-collapse-accent">{tag}</span>;
}

// ── Page: Team Home / Scout ────────────────────────────────────────────────
function TeamPage({ teams, tournament, mode = 'home', team, setTeam }: {
  teams: string[]; tournament: Tournament; mode?: 'home' | 'scout';
  team: string; setTeam: (t: string) => void;
}) {
  const accentColor = mode === 'scout' ? '#7C3AED' : '#0EA5E9';

  const { data } = useQuery<TeamHome>({
    queryKey: ['team-home', team, tournament],
    queryFn: () => get(`/api/coach/team/${encodeURIComponent(team)}/home?tournament=${tournament}`),
    enabled: !!team,
  });
  const { data: avg } = useQuery<Record<string, number>>({
    queryKey: ['tournament-avg', tournament],
    queryFn: () => get(`/api/coach/tournament-avg?tournament=${tournament}`),
  });

  return (
    <div className="space-y-5">
      {tournament === 'wc2026' && <SimBanner/>}

      {/* What this page does */}
      <div className="flex items-start gap-3 bg-collapse-surface border border-collapse-border rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-collapse-accent shrink-0 mt-0.5"/>
        <p className="text-xs text-collapse-muted leading-relaxed">
          {mode === 'home'
            ? <>Select <strong className="text-collapse-text">your team</strong> to see their tactical fingerprint, when they are most likely to collapse, and the two actions that reduce collapse risk most. Data is computed from all WC 2022 matches.</>
            : <>Select <strong className="text-collapse-text">an opponent</strong> to understand what style they play, when they become vulnerable, and what they do to stabilise. Use this before the Matchup page.</>
          }
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Dropdown options={teams} value={team} onChange={setTeam} placeholder={mode === 'scout' ? 'Select opponent…' : 'Select your team…'} accent={accentColor}/>
        {data && <DataBadge source={data.data_source} hasRealData={data.has_real_data}/>}
      </div>

      {!team && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <BrainCircuit className="w-10 h-10 text-collapse-border"/>
          <p className="text-collapse-muted text-sm">Select a team above to load their profile</p>
        </div>
      )}

      {team && !data && <div className="h-40 flex items-center justify-center text-collapse-muted text-sm">Loading…</div>}

      {data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Style */}
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Style Fingerprint</p>
                <p className="text-[10px] text-collapse-dim mt-0.5">3 dominant traits derived from WC event patterns</p>
              </div>
              <div className="flex flex-wrap gap-2">{data.style_tags.map(t => <StyleTag key={t} tag={t}/>)}</div>
              <p className="text-xs text-collapse-dim leading-relaxed border-t border-collapse-border pt-3">
                These tags summarise how the team typically operates — passing structure, defensive shape, and pressing triggers — across their WC matches.
              </p>
            </div>

            {/* Card 2: Collapse profile */}
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Collapse Profile</p>
                <p className="text-[10px] text-collapse-dim mt-0.5">When &amp; why risk peaks in their matches</p>
              </div>
              <div className="bg-collapse-bg rounded-xl p-3 text-center border border-collapse-border">
                <p className="text-[10px] text-collapse-muted mb-1 uppercase tracking-wider">Most likely danger window</p>
                <p className="text-3xl font-black font-mono text-collapse-warn">{data.collapse_window}</p>
              </div>
              <div className="space-y-2 border-t border-collapse-border pt-3">
                <p className="text-[10px] text-collapse-muted font-bold uppercase">Top 2 triggers</p>
                {data.top_triggers.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-collapse-text">
                    <ChevronRight className="w-3.5 h-3.5 text-collapse-risk shrink-0 mt-0.5"/>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Stabilizers */}
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Top Stabilizers</p>
                <p className="text-[10px] text-collapse-dim mt-0.5">Actions that most reduce their collapse risk</p>
              </div>
              <div className="space-y-3">
                {data.stabilizers.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-collapse-safe/5 border border-collapse-safe/20 rounded-xl px-3 py-2.5">
                    <TrendingDown className="w-3.5 h-3.5 text-collapse-safe shrink-0 mt-0.5"/>
                    <span className="text-xs text-collapse-text">{s}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-collapse-dim leading-relaxed border-t border-collapse-border pt-3">
                Stabilizers are tactical actions that historically reduce the team's probability of entering a collapse phase.
              </p>
            </div>
          </div>

          {/* Fingerprint bar chart */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Tactical Fingerprint vs Tournament Average</p>
              <DataBadge source={data.data_source} hasRealData={data.has_real_data}/>
            </div>
            <p className="text-[10px] text-collapse-dim mb-4">
              Each metric is computed from event-level data — passing sequences, turnover locations, defensive actions, and territory control. Red = above WC average (not always bad), blue = below.
            </p>
            <FingerprintChart fp={data.fingerprint} avg={avg} teamName={team}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page: Matchup ──────────────────────────────────────────────────────────
function MatchupPage({ teams, tournament, teamA, setTeamA, teamB, setTeamB }: {
  teams: string[]; tournament: Tournament;
  teamA: string; setTeamA: (t: string) => void;
  teamB: string; setTeamB: (t: string) => void;
}) {
  const [press,  setPress]  = useState<PressLevel>(50);
  const [build,  setBuild]  = useState<BuildStyle>(50);
  const [tempo,  setTempo]  = useState<TempoCtrl>(50);

  const { data, isLoading } = useQuery<MatchupHero>({
    queryKey: ['matchup-hero', teamA, teamB, press, build, tempo],
    queryFn: () => get(`/api/coach/matchup-hero?team_a=${encodeURIComponent(teamA)}&team_b=${encodeURIComponent(teamB)}&press=${press}&build=${build}&tempo=${tempo}`),
    enabled: !!teamA && !!teamB && teamA !== teamB,
  });

  return (
    <div className="space-y-5">
      {tournament === 'wc2026' && <SimBanner/>}

      <div className="flex items-start gap-3 bg-collapse-surface border border-collapse-border rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-collapse-accent shrink-0 mt-0.5"/>
        <p className="text-xs text-collapse-muted leading-relaxed">
          Select two teams to generate a matchup. The hero row shows <strong className="text-collapse-text">win range, collapse risk range, and the danger window</strong> — all 3 numbers update live when you toggle the plan levers below. Click any insight to see the evidence.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Dropdown options={teams} value={teamA} onChange={setTeamA} placeholder="Your team…" accent="#0EA5E9"/>
        <span className="font-bold text-collapse-border text-sm">vs</span>
        <Dropdown options={teams.filter(t => t !== teamA)} value={teamB} onChange={setTeamB} placeholder="Opponent…" accent="#7C3AED"/>
      </div>

      {(!teamA || !teamB) && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Swords className="w-10 h-10 text-collapse-border"/>
          <p className="text-collapse-muted text-sm">Select both teams to generate the matchup analysis</p>
        </div>
      )}

      {isLoading && <div className="h-40 flex items-center justify-center text-collapse-muted text-sm">Computing matchup…</div>}

      {data && (
        <div className="space-y-5">
          {/* Hero: 3 numbers */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 text-center">
              <p className="text-[10px] text-collapse-muted uppercase tracking-wider mb-2">Win Range</p>
              <p className="text-3xl font-black font-mono text-collapse-accent leading-none">
                {data.win_range.low}–{data.win_range.high}<span className="text-base font-bold">%</span>
              </p>
              <p className="text-[10px] text-collapse-dim mt-1.5">{data.team_a} probability</p>
            </div>
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 text-center">
              <p className="text-[10px] text-collapse-muted uppercase tracking-wider mb-2">Collapse Risk</p>
              <p className="text-3xl font-black font-mono text-collapse-risk leading-none">
                {data.collapse_range.low}–{data.collapse_range.high}<span className="text-base font-bold">%</span>
              </p>
              <p className="text-[10px] text-collapse-dim mt-1.5">{data.team_a}</p>
            </div>
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 text-center">
              <p className="text-[10px] text-collapse-muted uppercase tracking-wider mb-2">Danger Window</p>
              <p className="text-3xl font-black font-mono text-collapse-warn leading-none">{data.collapse_window}</p>
              <p className="text-[10px] text-collapse-dim mt-1.5">Peak risk minutes</p>
            </div>
          </div>

          {/* Triggers */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted mb-3">Top Collapse Triggers — {data.team_a}</p>
            <div className="grid grid-cols-2 gap-3">
              {data.top_triggers.map((t, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-collapse-risk/5 border border-collapse-risk/20 rounded-xl px-3 py-2.5">
                  <span className="w-5 h-5 rounded-full bg-collapse-risk/20 text-collapse-risk text-[10px] flex items-center justify-center shrink-0 font-bold">{i+1}</span>
                  <span className="text-xs text-collapse-text">{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Evidence — click any card to see the proof</p>
            {data.insights.map((ins, i) => <InsightCard key={i} insight={ins} index={i}/>)}
          </div>

          {/* Plan levers */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Plan Levers</p>
              <p className="text-[10px] text-collapse-dim mt-0.5">Toggle any lever — the 3 hero numbers above update instantly</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <LeverGroup label="Press Level" tooltip="How aggressively your team presses when losing the ball" opts={[[25,'Low'],[50,'Medium'],[75,'High']] as [PressLevel, string][]} value={press} onChange={setPress}/>
              <LeverGroup label="Build Style" tooltip="How you move the ball out from defence — direct balls vs short passing sequences" opts={[[25,'Direct'],[50,'Mixed'],[75,'Possession']] as [BuildStyle, string][]} value={build} onChange={setBuild}/>
              <LeverGroup label="Tempo" tooltip="Overall speed of play and transition pace" opts={[[25,'Fast'],[50,'Balanced'],[75,'Controlled']] as [TempoCtrl, string][]} value={tempo} onChange={setTempo}/>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-collapse-border">
              {data.levers[0] && (
                <div className="rounded-xl bg-collapse-safe/5 border border-collapse-safe/25 px-3 py-3">
                  <p className="text-[10px] text-collapse-safe uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3"/>Best lever</p>
                  <p className="text-xs text-collapse-text leading-snug">{data.levers[0].action}</p>
                  <p className="text-[10px] font-mono text-collapse-safe mt-1">{data.levers[0].delta.toFixed(1)}% collapse</p>
                </div>
              )}
              {data.levers[1] && (
                <div className="rounded-xl bg-collapse-accent/5 border border-collapse-accent/25 px-3 py-3">
                  <p className="text-[10px] text-collapse-accent uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3"/>2nd best</p>
                  <p className="text-xs text-collapse-text leading-snug">{data.levers[1].action}</p>
                  <p className="text-[10px] font-mono text-collapse-accent mt-1">{data.levers[1].delta.toFixed(1)}% collapse</p>
                </div>
              )}
              <div className="rounded-xl bg-collapse-risk/5 border border-collapse-risk/25 px-3 py-3">
                <p className="text-[10px] text-collapse-risk uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Do not do</p>
                <p className="text-xs text-collapse-text leading-snug">{data.dont_do}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page: Match Replay ─────────────────────────────────────────────────────
function ReplayPage({ teams }: { teams: string[] }) {
  const [team, setTeam] = useState('');
  const [matchId, setMatchId] = useState<number | null>(null);
  const [openMoment, setOpenMoment] = useState<number | null>(null);

  const { data: matches = [] } = useQuery<any[]>({
    queryKey: ['team-matches', team],
    queryFn: () => get(`/api/coach/team/${encodeURIComponent(team)}/matches`),
    enabled: !!team,
  });
  const { data: replay, isLoading: replayLoading } = useQuery<any>({
    queryKey: ['match-replay', matchId],
    queryFn: () => get(`/api/coach/match/${matchId}/replay`),
    enabled: matchId !== null,
  });
  const { data: goals = [] } = useQuery<any[]>({
    queryKey: ['replay-goals', matchId],
    queryFn: () => get(`/api/match/${matchId}/goals`),
    enabled: matchId !== null,
  });
  const { data: shootout } = useQuery<any>({
    queryKey: ['shootout-coach', matchId],
    queryFn: () => get(`/api/match/${matchId}/shootout`),
    enabled: matchId !== null && !!replay?.extra_time,
  });

  // Derived stats from timeline
  const tl: any[] = replay?.timeline ?? [];
  const peakRisk  = tl.length ? Math.max(...tl.map((t: any) => t.probability)) : 0;
  const peakMin   = tl.length ? tl.reduce((best: any, t: any) => t.probability > best.probability ? t : best, tl[0]).minute : 0;
  const avgRisk   = tl.length ? tl.reduce((s: number, t: any) => s + t.probability, 0) / tl.length : 0;
  const h1        = tl.filter((t: any) => t.minute <= 45);
  const h2        = tl.filter((t: any) => t.minute > 45 && t.minute <= 90);
  const avgH1     = h1.length ? h1.reduce((s: number, t: any) => s + t.probability, 0) / h1.length : 0;
  const avgH2     = h2.length ? h2.reduce((s: number, t: any) => s + t.probability, 0) / h2.length : 0;
  const spikes    = replay ? replay.key_moments.filter((m: any) => m.type === 'spike').length : 0;
  const riskTrend = tl.length > 10
    ? tl.slice(-10).reduce((s: number, t: any) => s + t.probability, 0) / 10
      > tl.slice(0, 10).reduce((s: number, t: any) => s + t.probability, 0) / 10
      ? 'Rising' : 'Falling'
    : null;

  // Sustained high-risk windows (5+ consecutive minutes ≥ 0.55)
  const highWindows: { start: number; end: number; avg: number }[] = [];
  if (tl.length) {
    let winStart = -1;
    for (let i = 0; i < tl.length; i++) {
      if (tl[i].probability >= 0.55) {
        if (winStart < 0) winStart = tl[i].minute;
      } else {
        if (winStart >= 0 && tl[i].minute - winStart >= 5) {
          const slice = tl.filter((t: any) => t.minute >= winStart && t.minute < tl[i].minute);
          highWindows.push({ start: winStart, end: tl[i - 1].minute,
            avg: slice.reduce((s: number, t: any) => s + t.probability, 0) / slice.length });
        }
        winStart = -1;
      }
    }
  }

  // Goals near each spike (within ±5 min)
  const goalsNearSpike = (min: number) =>
    (goals as any[]).filter((g: any) => Math.abs(g.minute - min) <= 5);

  const momentContext = (m: any): React.ReactNode => {
    // ── Risk spike ─────────────────────────────────────────────────────────
    if (m.type === 'spike') {
      const nearby       = goalsNearSpike(m.minute);
      const forGoals     = nearby.filter((g: any) => g.scoring_team === replay?.home);
      const againstGoals = nearby.filter((g: any) => g.scoring_team !== replay?.home);
      const isMatchPeak  = Math.abs(m.minute - peakMin) <= 3;
      const severity     = m.delta >= 0.20 ? 'extreme' : m.delta >= 0.12 ? 'significant' : 'moderate';
      return (
        <div className="space-y-3">
          {/* What happened */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <div className="shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">What happened</span>
            </div>
            <p className="text-xs text-collapse-muted leading-relaxed">
              Collapse probability jumped <span className="text-amber-400 font-bold">+{(m.delta * 100).toFixed(0)}pp</span> in a single minute at <span className="font-mono font-semibold text-collapse-text">{m.minute}'</span>.
              That is a <span className="text-collapse-text font-medium">{severity}</span> spike —
              {isMatchPeak ? ' and it is the single highest-risk moment of this match.' : ` the match peak was ${peakMin}'.`}
            </p>
          </div>

          {/* Cause */}
          <div>
            <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wide mb-1.5">Likely cause</p>
            {againstGoals.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-collapse-muted">
                <span className="text-red-400 shrink-0 mt-0.5">⚽</span>
                <p>
                  <span className="text-red-400 font-semibold">{againstGoals[0].scoring_team}</span>
                  {againstGoals[0].scorer ? ` (${againstGoals[0].scorer})` : ''} scored at {againstGoals[0].minute}'.
                  Conceding a goal within ±5 min is the strongest predictor of a risk spike — teams lose defensive shape reacting to the restart.
                </p>
              </div>
            )}
            {forGoals.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-collapse-muted">
                <span className="text-emerald-400 shrink-0 mt-0.5">⚽</span>
                <p>
                  <span className="text-emerald-400 font-semibold">{replay?.home}</span>
                  {forGoals[0].scorer ? ` (${forGoals[0].scorer})` : ''} scored at {forGoals[0].minute}'.
                  Attacking surges expose the team to fast counter-attacks, which can drive a temporary risk spike even when scoring.
                </p>
              </div>
            )}
            {nearby.length === 0 && (
              <p className="text-xs text-collapse-muted leading-relaxed">
                No goal within ±5 min — this is a <span className="text-collapse-text font-medium">pressure-driven spike</span>.
                Common causes: high press forcing errors, a dangerous set-piece sequence, or a rapid transition cluster that did not result in a goal.
              </p>
            )}
          </div>
        </div>
      );
    }

    // ── Extra time ─────────────────────────────────────────────────────────
    if (m.type === 'et_start') {
      const etSlice = tl.filter((t: any) => t.minute > 90);
      const avgEt   = etSlice.length ? etSlice.reduce((s: number, t: any) => s + t.probability, 0) / etSlice.length : null;
      const etDelta = avgEt !== null ? avgEt - avgRisk : null;
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
            <p className="text-xs text-collapse-muted leading-relaxed">
              After 90 minutes at a draw, both teams enter extra time with accumulated fatigue. Defensive shape breaks down, pressing intensity drops, and transition windows widen — making collapse significantly more likely.
            </p>
          </div>
          {avgEt !== null && etDelta !== null && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-collapse-bg rounded-lg px-3 py-2">
                <p className="text-sm font-bold font-mono text-collapse-text">{(avgRisk * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-collapse-dim">Avg risk (90 min)</p>
                <p className="text-[10px] text-collapse-dim mt-0.5">Baseline across the full match</p>
              </div>
              <div className="bg-collapse-bg rounded-lg px-3 py-2">
                <p className={`text-sm font-bold font-mono ${etDelta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{(avgEt * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-collapse-dim">Avg risk (ET)</p>
                <p className={`text-[10px] mt-0.5 ${etDelta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {etDelta > 0 ? `↑ +${(etDelta*100).toFixed(0)}pp vs 90-min avg` : `↓ ${(etDelta*100).toFixed(0)}pp vs 90-min avg`}
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Penalties ──────────────────────────────────────────────────────────
    if (m.type === 'penalties')
      return (
        <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/15 space-y-1.5">
          <p className="text-xs font-semibold text-purple-300">Highest-pressure scenario in football</p>
          <p className="text-xs text-collapse-muted leading-relaxed">
            After 120 minutes neither team found a winner. A penalty shootout is a pure mental pressure event — collapse risk is no longer driven by tactical patterns but by individual execution under maximum stress. {m.label}.
          </p>
        </div>
      );

    // ── Final whistle ──────────────────────────────────────────────────────
    const dangerHalf = avgH2 > avgH1 ? '2nd half' : '1st half';
    const saferHalf  = dangerHalf === '2nd half' ? '1st half' : '2nd half';
    const etGoals    = (goals as any[]).filter((g: any) => g.minute > 90);
    const topSpike   = replay?.key_moments.filter((k: any) => k.type === 'spike').sort((a: any, b: any) => b.delta - a.delta)[0];
    const goalsFor   = (goals as any[]).filter((g: any) => g.scoring_team === replay?.home);
    const goalsAgs   = (goals as any[]).filter((g: any) => g.scoring_team !== replay?.home);
    return (
      <div className="space-y-3">
        {/* Half-by-half comparison */}
        <div>
          <p className="text-[10px] font-bold text-collapse-muted uppercase tracking-wide mb-2">Half-by-half collapse load</p>
          <div className="space-y-2">
            {[
              { half: '1st half (1–45\')', avg: avgH1 },
              { half: '2nd half (46–90\')', avg: avgH2 },
            ].map(h => (
              <div key={h.half}>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-collapse-muted">{h.half}</span>
                  <span className={`font-mono font-semibold ${h.avg >= 0.55 ? 'text-red-400' : h.avg >= 0.35 ? 'text-amber-400' : 'text-emerald-400'}`}>{(h.avg * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-collapse-border overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${h.avg >= 0.55 ? 'bg-red-400' : h.avg >= 0.35 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${(h.avg * 100).toFixed(0)}%` }}/>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-collapse-dim mt-2">
            The <span className="text-collapse-text font-medium">{dangerHalf}</span> was more dangerous
            ({dangerHalf === '2nd half' ? (avgH2*100).toFixed(0) : (avgH1*100).toFixed(0)}% avg vs {saferHalf === '2nd half' ? (avgH2*100).toFixed(0) : (avgH1*100).toFixed(0)}% in the {saferHalf}).
          </p>
        </div>

        {/* Key stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Peak risk', value: `${(peakRisk * 100).toFixed(0)}% @ ${peakMin}'`, explain: 'Highest single-minute collapse probability', hi: peakRisk >= 0.65 },
            { label: 'Risk spikes', value: `${spikes} moment${spikes !== 1 ? 's' : ''}`, explain: 'Jumps ≥8pp in one minute', hi: spikes >= 3 },
            { label: 'Goals scored', value: goalsFor.length.toString(), explain: `By ${replay?.home}`, hi: false },
            { label: 'Goals conceded', value: goalsAgs.length.toString(), explain: `By ${replay?.away}`, hi: goalsAgs.length >= 2 },
          ].map(s => (
            <div key={s.label} className="bg-collapse-bg rounded-lg px-3 py-2">
              <p className={`text-sm font-bold font-mono ${s.hi ? 'text-red-400' : 'text-collapse-text'}`}>{s.value}</p>
              <p className="text-[10px] text-collapse-muted font-medium mt-0.5">{s.label}</p>
              <p className="text-[10px] text-collapse-dim">{s.explain}</p>
            </div>
          ))}
        </div>

        {/* Narrative bullets */}
        <div className="space-y-1.5">
          {topSpike && (
            <div className="flex items-start gap-2 text-xs text-collapse-muted">
              <span className="text-amber-400 shrink-0">▲</span>
              <p>Biggest spike was <span className="text-amber-400 font-semibold">+{(topSpike.delta*100).toFixed(0)}pp</span> at {topSpike.minute}' — the single most dangerous transition in the match.</p>
            </div>
          )}
          {highWindows.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-collapse-muted">
              <span className="text-red-400 shrink-0">◉</span>
              <p>{highWindows.length} sustained high-risk window{highWindows.length > 1 ? 's' : ''} (5+ consecutive minutes above 55%) — {highWindows[0].start}'–{highWindows[0].end}' was the longest.</p>
            </div>
          )}
          {etGoals.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-collapse-muted">
              <span className="text-blue-400 shrink-0">⚡</span>
              <p>{etGoals.length} goal{etGoals.length > 1 ? 's' : ''} scored in extra time — fatigue-driven collapse contributed to late concessions.</p>
            </div>
          )}
          {highWindows.length === 0 && spikes <= 1 && (
            <div className="flex items-start gap-2 text-xs text-collapse-muted">
              <span className="text-emerald-400 shrink-0">✓</span>
              <p>No sustained high-risk periods — {replay?.home} maintained defensive control for the majority of the match.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        <Dropdown options={teams} value={team} onChange={v => { setTeam(v); setMatchId(null); }} placeholder="Select team…"/>
        {matches.length > 0 && (
          <Dropdown
            options={matches.map((m: any) => `${m.home} vs ${m.away} (${m.score}${m.extra_time ? ' AET' : ''})`)}
            value={matchId !== null
              ? (() => { const m = matches.find((m: any) => m.match_id === matchId); return m ? `${m.home} vs ${m.away} (${m.score}${m.extra_time ? ' AET' : ''})` : ''; })()
              : ''}
            onChange={v => { const m = matches.find((m: any) => `${m.home} vs ${m.away} (${m.score}${m.extra_time ? ' AET' : ''})` === v); if (m) setMatchId(m.match_id); }}
            placeholder="Select match…"
            accent="#F5A623"
          />
        )}
      </div>

      {!matchId && !replayLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-collapse-surface border border-collapse-border flex items-center justify-center">
            <Film className="w-7 h-7 text-collapse-border"/>
          </div>
          <div>
            <p className="text-collapse-text font-medium mb-1">Collapse Replay</p>
            <p className="text-collapse-muted text-sm max-w-xs">Pick a team then a match to see the full collapse probability curve, goal moments, and risk spikes frame-by-frame.</p>
          </div>
        </div>
      )}

      {replayLoading && (
        <div className="h-40 flex items-center justify-center gap-2 text-collapse-muted text-sm">
          <div className="w-4 h-4 border-2 border-collapse-accent border-t-transparent rounded-full animate-spin"/>
          Loading replay…
        </div>
      )}

      {replay && (
        <div className="space-y-4">
          {/* Match header */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold">{replay.home}</span>
                  <span className="text-collapse-muted text-sm font-mono font-black px-2">{replay.score}</span>
                  <span className="text-lg font-bold">{replay.away}</span>
                  {replay.extra_time && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wide ml-1">AET</span>
                  )}
                </div>
                {replay.extra_time && replay.penalty_winner && (
                  <p className="text-xs text-amber-400">
                    <Trophy className="w-3 h-3 inline mr-1"/>
                    {replay.penalty_winner} win on penalties ({replay.penalty_score})
                  </p>
                )}
              </div>
              {/* Risk tier badge */}
              <div className={`text-right px-4 py-2 rounded-xl border ${
                peakRisk >= 0.65 ? 'bg-red-500/10 border-red-500/30' :
                peakRisk >= 0.40 ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                <p className={`text-xl font-black font-mono ${peakRisk >= 0.65 ? 'text-red-400' : peakRisk >= 0.40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(peakRisk * 100).toFixed(0)}%
                </p>
                <p className="text-[10px] uppercase tracking-wide text-collapse-muted">Peak risk</p>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Avg Risk',
                value: `${(avgRisk * 100).toFixed(0)}%`,
                status: avgRisk >= 0.55 ? 'HIGH' : avgRisk >= 0.35 ? 'MED' : 'LOW',
                explain: 'Mean collapse probability across all minutes played. Above 55% means the team was under sustained defensive pressure for most of the match.',
                color: avgRisk >= 0.55 ? 'text-red-400' : avgRisk >= 0.35 ? 'text-amber-400' : 'text-emerald-400',
                badge: avgRisk >= 0.55 ? 'bg-red-500/10 text-red-400 border-red-500/20' : avgRisk >= 0.35 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              },
              {
                label: 'Risk Spikes',
                value: spikes.toString(),
                status: spikes >= 4 ? 'VOLATILE' : spikes >= 2 ? 'MODERATE' : 'STABLE',
                explain: 'Count of minutes where risk jumped ≥8pp in one step. Each spike marks a high-danger moment — typically a goal conceded, dangerous transition, or set-piece cluster.',
                color: spikes >= 4 ? 'text-red-400' : spikes >= 2 ? 'text-amber-400' : 'text-emerald-400',
                badge: spikes >= 4 ? 'bg-red-500/10 text-red-400 border-red-500/20' : spikes >= 2 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              },
              {
                label: 'End Trend',
                value: riskTrend ?? '—',
                status: riskTrend === 'Rising' ? 'WORSENING' : 'RECOVERING',
                explain: 'Compares avg risk in the final 10 minutes vs the opening 10 minutes. "Rising" means the team finished the match more exposed than they started.',
                color: riskTrend === 'Rising' ? 'text-red-400' : 'text-emerald-400',
                badge: riskTrend === 'Rising' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              },
            ].map(k => (
              <div key={k.label} className="bg-collapse-surface border border-collapse-border rounded-xl px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-2xl font-black font-mono leading-none ${k.color}`}>{k.value}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider shrink-0 ${k.badge}`}>{k.status}</span>
                </div>
                <p className="text-[11px] font-semibold text-collapse-text">{k.label}</p>
                <p className="text-[10px] text-collapse-dim leading-relaxed">{k.explain}</p>
              </div>
            ))}
          </div>

          {/* Timeline chart */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-collapse-text">Collapse Probability — {replay.home}</p>
                <p className="text-[10px] text-collapse-dim mt-0.5">
                  <span className="inline-block w-2 h-0.5 bg-amber-400 mr-1 align-middle"/>spike
                  <span className="inline-block w-2 h-0.5 bg-emerald-400 mx-1 align-middle"/>goal (for)
                  <span className="inline-block w-2 h-0.5 bg-red-400 mx-1 align-middle"/>goal (against)
                  {replay.extra_time && <><span className="inline-block w-2 h-0.5 bg-amber-300 mx-1 align-middle"/>ET</>}
                </p>
              </div>
              <p className="text-[10px] text-collapse-dim">Click a moment below ↓</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={replay.timeline} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGradR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF3B5C" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#FF3B5C" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="minute" tick={{ fill: '#64748B', fontSize: 10 }} interval={14}
                  tickFormatter={v => `${v}'`} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={v => `${Math.round(v*100)}%`}
                  domain={[0, 1]} axisLine={false} tickLine={false} ticks={[0, 0.25, 0.5, 0.75, 1]}/>
                <Tooltip
                  formatter={(v: number) => [`${(v * 100).toFixed(0)}%`, 'Collapse Risk']}
                  labelFormatter={l => `Minute ${l}'`}
                  contentStyle={{ background: '#0F1929', border: '1px solid #1C2D40', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FF3B5C' }}/>
                {/* 50% danger threshold */}
                <ReferenceLine y={0.5} stroke="#FF3B5C" strokeDasharray="4 2" strokeWidth={1} opacity={0.35}
                  label={{ value: '50%', fill: '#FF3B5C', fontSize: 9, position: 'insideTopRight', opacity: 0.6 }}/>
                {/* Spike markers */}
                {replay.key_moments.filter((m: any) => m.type === 'spike').map((m: any) => (
                  <ReferenceLine key={`spike-${m.minute}`} x={m.minute} stroke="#F5A623"
                    strokeDasharray="3 2" strokeWidth={1.5} opacity={0.8}/>
                ))}
                {/* Goal markers */}
                {goals.map((g: any, i: number) => {
                  const isFor = g.scoring_team === replay.home;
                  return (
                    <ReferenceLine key={`goal-${i}`} x={g.minute}
                      stroke={isFor ? '#10B981' : '#EF4444'} strokeWidth={2} opacity={0.7}
                      label={{ value: isFor ? '⚽' : '⚽', fill: isFor ? '#10B981' : '#EF4444', fontSize: 9,
                        position: isFor ? 'insideTopLeft' : 'insideBottomLeft' }}/>
                  );
                })}
                {/* ET marker */}
                {replay.extra_time && (
                  <ReferenceLine x={90} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3"
                    label={{ value: 'ET', fill: '#f59e0b', fontSize: 9, position: 'insideTopLeft' }}/>
                )}
                <Area type="monotone" dataKey="probability" stroke="#FF3B5C" strokeWidth={2.5}
                  fill="url(#riskGradR)" dot={false} activeDot={{ r: 4, fill: '#FF3B5C' }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Key Moments list */}
          {replay.key_moments.length > 0 && (
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-collapse-border">
                <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Key Moments</p>
              </div>
              <div className="divide-y divide-collapse-border">
                {replay.key_moments.map((m: any, i: number) => {
                  const isOpen = openMoment === i;
                  const iconColor =
                    m.type === 'spike'    ? 'text-amber-400 bg-amber-400/10' :
                    m.type === 'et_start' ? 'text-blue-400 bg-blue-400/10' :
                    m.type === 'penalties'? 'text-purple-400 bg-purple-400/10' :
                    'text-emerald-400 bg-emerald-400/10';
                  const Icon =
                    m.type === 'spike'     ? AlertTriangle :
                    m.type === 'et_start'  ? TrendingDown :
                    m.type === 'penalties' ? Trophy :
                    Film;
                  return (
                    <button key={i} onClick={() => setOpenMoment(isOpen ? null : i)}
                      className={`w-full text-left transition-colors ${isOpen ? 'bg-collapse-bg' : 'hover:bg-collapse-bg/50'}`}>
                      <div className="flex items-center gap-4 px-5 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                          <Icon className="w-4 h-4"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-collapse-text truncate">{m.label}</p>
                          {m.delta > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-1 rounded-full bg-collapse-border flex-1 max-w-24 overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, m.delta * 250)}%` }}/>
                              </div>
                              <span className="text-[10px] font-mono text-amber-400">+{(m.delta*100).toFixed(0)}pp</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-mono text-collapse-muted shrink-0">{m.minute}'</span>
                        <ChevronRight className={`w-4 h-4 text-collapse-border transition-transform ${isOpen ? 'rotate-90' : ''}`}/>
                      </div>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="px-5 pb-4 pt-0 pl-[4.25rem]">
                              <div className="text-xs text-collapse-muted leading-relaxed">{momentContext(m)}</div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Penalty Shootout */}
          {shootout?.has_shootout && shootout.kicks && (
            <div className="bg-collapse-surface border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-400"/>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Penalty Shootout</p>
                <span className="ml-auto text-sm font-black text-amber-300 font-mono">{shootout.penalty_winner} win {shootout.penalty_score}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(shootout.kicks as Record<string, [string,boolean][]>).map(([teamName, kicks]) => (
                  <div key={teamName}>
                    <p className="text-[10px] font-bold text-collapse-muted uppercase mb-2">{teamName}</p>
                    <div className="space-y-1.5">
                      {kicks.map(([scorer, scored], ki) => (
                        <div key={ki} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${scored ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          <span className="font-black">{scored ? '✓' : '✗'}</span>
                          <span>{scorer || `Kick ${ki + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
const PAGES: { id: Page; label: string; icon: typeof BrainCircuit }[] = [
  { id: 'home',    label: 'Team Home',      icon: BrainCircuit },
  { id: 'scout',   label: 'Opponent Scout', icon: Target },
  { id: 'matchup', label: 'Matchup',        icon: Swords },
  { id: 'replay',  label: 'Match Replay',   icon: Film },
];

export function CoachView() {
  const [page, setPage] = useState<Page>('matchup');
  const [tournament, setTournament] = useState<Tournament>('wc2022');

  // Each tournament keeps its own independent selections, persisted across refreshes
  type Sel = { home: string; scout: string; teamA: string; teamB: string };
  const EMPTY_SEL: Sel = { home: '', scout: '', teamA: '', teamB: '' };
  const [sel, setSel] = useState<Record<Tournament, Sel>>({ wc2022: EMPTY_SEL, wc2026: EMPTY_SEL });

  const cur = sel[tournament];
  const mkSet = (field: keyof Sel) => (v: string) =>
    setSel(prev => ({ ...prev, [tournament]: { ...prev[tournament], [field]: v } }));

  const setHomeTeam  = mkSet('home');
  const setScoutTeam = mkSet('scout');
  const setTeamA     = mkSet('teamA');
  const setTeamB     = mkSet('teamB');

  const { data: teams = [] } = useQuery<string[]>({
    queryKey: ['coach-teams', tournament],
    queryFn: () => get(`/api/coach/teams?tournament=${tournament}`),
  });

  return (
    <div className="h-full flex flex-col bg-collapse-bg text-collapse-text overflow-hidden">
      <div className="shrink-0 px-8 pt-6 pb-0 border-b border-collapse-border bg-collapse-surface">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-collapse-accent to-collapse-purple flex items-center justify-center shadow-lg shadow-collapse-accent/20">
              <BrainCircuit className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Coach View</h1>
              <p className="text-xs text-collapse-muted">
                {tournament === 'wc2022'
                  ? 'WC 2022 event data · 32 national teams · 65 matches'
                  : 'WC 2026 simulation · priors from WC 2022'}
              </p>
            </div>
          </div>
          <TournamentPicker value={tournament} onChange={setTournament}/>
        </div>
        <div className="flex gap-1">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                page === id ? 'border-collapse-accent text-collapse-accent bg-collapse-accent/5' : 'border-transparent text-collapse-muted hover:text-collapse-text'
              }`}>
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {page === 'home'    && <TeamPage    teams={teams} tournament={tournament} mode="home"  team={cur.home}  setTeam={setHomeTeam}/>}
        {page === 'scout'   && <TeamPage    teams={teams} tournament={tournament} mode="scout" team={cur.scout} setTeam={setScoutTeam}/>}
        {page === 'matchup' && <MatchupPage teams={teams} tournament={tournament} teamA={cur.teamA} setTeamA={setTeamA} teamB={cur.teamB} setTeamB={setTeamB}/>}
        {page === 'replay'  && <ReplayPage  teams={teams}/>}
      </div>
    </div>
  );
}
