import { useState, useRef, useEffect } from 'react';
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
  const maxW = Math.max(...proof.zones.map((z: any) => z.w), 0.01);
  return (
    <div className="pt-2">
      <svg viewBox="0 0 120 80" className="w-full max-w-[280px] mx-auto block">
        <rect x="2" y="2" width="116" height="76" fill="none" stroke="#1C2D40" strokeWidth="1.5" rx="1"/>
        <line x1="60" y1="2" x2="60" y2="78" stroke="#1C2D40" strokeWidth="1"/>
        <circle cx="60" cy="40" r="12" fill="none" stroke="#1C2D40" strokeWidth="1"/>
        <rect x="2" y="25" width="18" height="30" fill="none" stroke="#1C2D40" strokeWidth="1"/>
        <rect x="100" y="25" width="18" height="30" fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {proof.zones.map((z: any) => {
          const r = 4 + (z.w / maxW) * 9;
          const intensity = z.w / maxW;
          return (
            <g key={z.label}>
              <circle cx={z.x * 1.16 + 2} cy={z.y * 0.76 + 2} r={r}
                fill={intensity > 0.7 ? '#FF3B5C' : intensity > 0.4 ? '#F5A623' : '#0EA5E9'}
                fillOpacity={0.25 + intensity * 0.55}/>
              <circle cx={z.x * 1.16 + 2} cy={z.y * 0.76 + 2} r={2.5}
                fill={intensity > 0.7 ? '#FF3B5C' : '#F5A623'}/>
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-collapse-dim text-center mt-1">Turnover density · larger circle = higher clustering</p>
    </div>
  );
}

function MiniTimeline({ proof }: { proof: any }) {
  const pts = proof.def_load.map((d: number, i: number) => ({
    i, def: Math.min(d * 100, 100), prob: Math.min(proof.probability[i] * 100, 100),
  }));
  const w = 260; const h = 70; const pad = 10;
  const xOf = (i: number) => pad + (i / (pts.length - 1)) * (w - pad * 2);
  const yOf = (v: number) => h - pad - (v / 100) * (h - pad * 2);
  const toPath = (key: 'def' | 'prob') =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(p[key]).toFixed(1)}`).join(' ');
  return (
    <div className="pt-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <path d={toPath('def')} fill="none" stroke="#0EA5E9" strokeWidth="2" opacity={0.7}/>
        <path d={toPath('prob')} fill="none" stroke="#FF3B5C" strokeWidth="2" opacity={0.85}/>
        <line x1={xOf(proof.onset)} y1={pad} x2={xOf(proof.onset)} y2={h - pad}
          stroke="#F5A623" strokeWidth="1.5" strokeDasharray="3 2"/>
        <text x={xOf(proof.onset) + 3} y={pad + 8} fill="#F5A623" fontSize="7">collapse onset</text>
      </svg>
      <div className="flex gap-4 justify-center text-[10px] text-collapse-muted mt-1">
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-collapse-accent inline-block"/>Def load</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-collapse-risk inline-block"/>Risk</span>
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
function TeamPage({ teams, tournament, mode = 'home' }: { teams: string[]; tournament: Tournament; mode?: 'home' | 'scout' }) {
  const [team, setTeam] = useState('');
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
function MatchupPage({ teams, tournament }: { teams: string[]; tournament: Tournament }) {
  const [teamA, setTeamA] = useState(teams[0] ?? '');
  const [teamB, setTeamB] = useState(teams[1] ?? '');
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
  const { data: shootout } = useQuery<any>({
    queryKey: ['shootout-coach', matchId],
    queryFn: () => get(`/api/match/${matchId}/shootout`),
    enabled: matchId !== null && !!replay?.extra_time,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 bg-collapse-surface border border-collapse-border rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-collapse-accent shrink-0 mt-0.5"/>
        <p className="text-xs text-collapse-muted leading-relaxed">
          Select a team, then a match to replay the <strong className="text-collapse-text">collapse probability curve</strong>. Orange dashed lines mark moments where risk spiked. Click any key moment for context.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Dropdown options={teams} value={team} onChange={v => { setTeam(v); setMatchId(null); }} placeholder="Select team…"/>
        {matches.length > 0 && (
          <Dropdown
            options={matches.map((m: any) => `${m.home} vs ${m.away} (${m.score}${m.extra_time ? ' AET' : ''})`)}
            value={matchId !== null ? (() => { const m = matches.find((m: any) => m.match_id === matchId); return m ? `${m.home} vs ${m.away} (${m.score}${m.extra_time ? ' AET' : ''})` : ''; })() : ''}
            onChange={v => { const m = matches.find((m: any) => `${m.home} vs ${m.away} (${m.score}${m.extra_time ? ' AET' : ''})` === v); if (m) setMatchId(m.match_id); }}
            placeholder="Select match…"
            accent="#F5A623"
          />
        )}
      </div>

      {!matchId && !replayLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Film className="w-10 h-10 text-collapse-border"/>
          <p className="text-collapse-muted text-sm">Select a team and match to load the collapse replay</p>
        </div>
      )}

      {replayLoading && <div className="h-40 flex items-center justify-center text-collapse-muted text-sm">Loading replay…</div>}

      {replay && (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-collapse-surface border border-collapse-border rounded-2xl px-5 py-3">
            <span className="font-semibold">{replay.home} vs {replay.away}</span>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="font-black font-mono text-2xl text-collapse-accent">{replay.score}</span>
                {replay.extra_time && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wide">AET</span>
                )}
              </div>
              {replay.extra_time && replay.penalty_winner && (
                <p className="text-xs text-amber-400 font-mono">{replay.penalty_winner} win {replay.penalty_score} pens</p>
              )}
            </div>
          </div>

          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted mb-1">Collapse Probability Timeline — {replay.home}</p>
            <p className="text-[10px] text-collapse-dim mb-4">
              Orange dashed = risk spikes · Red dashed = 50% threshold
              {replay.extra_time && ' · Amber line = Extra time starts (90\')'}
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={replay.timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF3B5C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF3B5C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="minute" tick={{ fill: '#64748B', fontSize: 10 }} interval={14} tickFormatter={v => `${v}'`} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={v => `${Math.round(v*100)}%`} domain={[0,1]} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v: number) => [`${(v*100).toFixed(0)}%`, 'Risk']} labelFormatter={l => `${l}'`}
                  contentStyle={{ background: '#0F1929', border: '1px solid #1C2D40', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FF3B5C' }}/>
                {replay.key_moments.filter((m: any) => m.type === 'spike').map((m: any) => (
                  <ReferenceLine key={m.minute} x={m.minute} stroke="#F5A623" strokeDasharray="3 2" strokeWidth={1.5}/>
                ))}
                <ReferenceLine y={0.5} stroke="#FF3B5C" strokeDasharray="4 2" strokeWidth={1} opacity={0.4}/>
                {replay.extra_time && (
                  <ReferenceLine x={90} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3"
                    label={{ value: 'ET', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }}/>
                )}
                <Area type="monotone" dataKey="probability" stroke="#FF3B5C" strokeWidth={2} fill="url(#riskGrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {replay.key_moments.length > 0 && (
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted mb-3">Key Moments — click for context</p>
              <div className="flex flex-wrap gap-2">
                {replay.key_moments.map((m: any, i: number) => (
                  <button key={i} onClick={() => setOpenMoment(openMoment === i ? null : i)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      openMoment === i ? 'bg-collapse-warn/10 border-collapse-warn text-collapse-warn' : 'bg-collapse-bg border-collapse-border text-collapse-muted hover:text-collapse-text'
                    }`}>
                    <span className="font-mono font-bold">{m.minute}'</span>
                    <span>{m.label}</span>
                    {m.delta > 0 && <span className="font-mono text-collapse-risk">+{(m.delta*100).toFixed(0)}%</span>}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {openMoment !== null && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-4 rounded-xl border border-collapse-warn/25 bg-collapse-warn/5 px-4 py-3">
                    <p className="text-sm font-semibold text-collapse-warn">{replay.key_moments[openMoment]?.label}</p>
                    <p className="text-xs text-collapse-muted mt-1">
                      {replay.key_moments[openMoment]?.type === 'spike'
                        ? `Collapse probability jumped ${(replay.key_moments[openMoment].delta * 100).toFixed(0)}pp — consistent with the turnover cluster pattern in this team's fingerprint.`
                        : 'Match completed. Full event timeline available via StatsBomb open data.'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
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
                          <span>{scorer}</span>
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
        {page === 'home'    && <TeamPage key={`home-${tournament}`}    teams={teams} tournament={tournament} mode="home"/>}
        {page === 'scout'   && <TeamPage key={`scout-${tournament}`}   teams={teams} tournament={tournament} mode="scout"/>}
        {page === 'matchup' && <MatchupPage key={`matchup-${tournament}`} teams={teams} tournament={tournament}/>}
        {page === 'replay'  && <ReplayPage key={`replay-${tournament}`}  teams={teams}/>}
      </div>
    </div>
  );
}
