import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BrainCircuit, Target, Swords, Film, ChevronDown, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { API_BASE } from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
type Tournament = 'wc2022' | 'wc2026';
type Page = 'home' | 'scout' | 'matchup' | 'replay';
type PressLevel = 25 | 50 | 75;
type BuildStyle  = 25 | 50 | 75;
type TempoCtrl   = 25 | 50 | 75;

interface TeamHome {
  team: string; style_tags: string[]; collapse_window: string;
  top_triggers: string[]; stabilizers: string[]; limited_prior?: boolean;
}
interface MatchupHero {
  team_a: string; team_b: string;
  win_range: { low: number; high: number };
  collapse_range: { low: number; high: number };
  collapse_window: string;
  top_triggers: string[];
  levers: { action: string; delta: number }[];
  dont_do: string;
  insights: Insight[];
}
interface Insight {
  headline: string; stat: string; proof_type: 'before_after' | 'heatmap' | 'mini_timeline';
  proof: any;
}
interface MatchReplay {
  match_id: number; home: string; away: string; score: string;
  timeline: { minute: number; probability: number }[];
  key_moments: { minute: number; type: string; label: string; delta: number }[];
}

// ── Fetcher ────────────────────────────────────────────────────────────────
const get = (path: string) => fetch(`${API_BASE}${path}`).then(r => r.json());

// ── Proof panels ───────────────────────────────────────────────────────────
function BeforeAfter({ proof }: { proof: { label_a: string; label_b: string; value_a: number; value_b: number; unit: string } }) {
  const max = Math.max(proof.value_a, proof.value_b, 100);
  return (
    <div className="space-y-3 pt-2">
      {[{ label: proof.label_a, val: proof.value_a }, { label: proof.label_b, val: proof.value_b }].map(({ label, val }) => (
        <div key={label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-collapse-muted">{label}</span>
            <span className="font-mono text-collapse-text font-bold">{val}% {proof.unit.replace('%', '')}</span>
          </div>
          <div className="h-3 bg-collapse-bg rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: val > 65 ? '#0BDE8C' : '#FF3B5C' }}
              initial={{ width: 0 }} animate={{ width: `${(val / max) * 100}%` }} transition={{ duration: 0.7 }} />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-collapse-dim pt-1">
        Delta: <span className="font-bold text-collapse-warn">{Math.abs(proof.value_b - proof.value_a).toFixed(0)} pp worse</span> against high-press teams
      </p>
    </div>
  );
}

function PitchHeatmap({ proof }: { proof: { zones: { label: string; x: number; y: number; w: number }[] } }) {
  const maxW = Math.max(...proof.zones.map((z: any) => z.w), 0.01);
  return (
    <div className="pt-2">
      <svg viewBox="0 0 120 80" className="w-full max-w-[280px] mx-auto block">
        {/* Pitch outline */}
        <rect x="2" y="2" width="116" height="76" fill="none" stroke="#1C2D40" strokeWidth="1.5" rx="1"/>
        {/* Center line */}
        <line x1="60" y1="2" x2="60" y2="78" stroke="#1C2D40" strokeWidth="1"/>
        {/* Center circle */}
        <circle cx="60" cy="40" r="12" fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {/* Goal boxes */}
        <rect x="2" y="25" width="18" height="30" fill="none" stroke="#1C2D40" strokeWidth="1"/>
        <rect x="100" y="25" width="18" height="30" fill="none" stroke="#1C2D40" strokeWidth="1"/>
        {/* Zone dots */}
        {proof.zones.map((z: any) => {
          const r = 4 + (z.w / maxW) * 9;
          const intensity = z.w / maxW;
          return (
            <g key={z.label}>
              <circle cx={z.x * 1.16 + 2} cy={z.y * 0.76 + 2} r={r}
                fill={intensity > 0.7 ? '#FF3B5C' : intensity > 0.4 ? '#F5A623' : '#0EA5E9'}
                fillOpacity={0.25 + intensity * 0.55} />
              <circle cx={z.x * 1.16 + 2} cy={z.y * 0.76 + 2} r={2.5}
                fill={intensity > 0.7 ? '#FF3B5C' : '#F5A623'} />
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-collapse-dim text-center mt-1">
        Turnover density by zone — larger = higher clustering
      </p>
    </div>
  );
}

function MiniTimeline({ proof }: { proof: { def_load: number[]; probability: number[]; onset: number } }) {
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
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-collapse-risk inline-block"/>Risk prob</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-collapse-warn inline-block" style={{ background: 'repeating-linear-gradient(90deg,#F5A623 0,#F5A623 3px,transparent 3px,transparent 6px)' }}/>Onset</span>
      </div>
    </div>
  );
}

// ── Shared atoms ───────────────────────────────────────────────────────────
function TeamSelector({ teams, value, onChange, accent = 'accent' }: { teams: string[]; value: string; onChange: (v: string) => void; accent?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`bg-collapse-surface border rounded-xl px-4 py-2.5 text-sm font-medium text-collapse-text focus:outline-none min-w-[170px] border-collapse-${accent}/40`}>
      <option value="">Select team…</option>
      {teams.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

function TournamentPicker({ value, onChange }: { value: Tournament; onChange: (v: Tournament) => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-collapse-border text-xs font-semibold">
      {([['wc2022', 'WC 2022'], ['wc2026', 'WC 2026 Sim']] as [Tournament, string][]).map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`px-4 py-2 transition-all ${value === id ? 'bg-collapse-accent text-white' : 'bg-collapse-surface text-collapse-muted hover:text-collapse-text'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function StyleTag({ tag }: { tag: string }) {
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-collapse-accent/10 border border-collapse-accent/25 text-collapse-accent">{tag}</span>;
}

// ── Page: Team Home / Scout ─────────────────────────────────────────────────
function TeamPage({ teams, tournament, mode = 'home' }: { teams: string[]; tournament: Tournament; mode?: 'home' | 'scout' }) {
  const [team, setTeam] = useState(teams[0] ?? '');
  const { data, isLoading } = useQuery<TeamHome>({
    queryKey: ['team-home', team, tournament],
    queryFn: () => get(`/api/coach/team/${encodeURIComponent(team)}/home?tournament=${tournament}`),
    enabled: !!team,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TeamSelector teams={teams} value={team} onChange={setTeam} accent={mode === 'scout' ? 'purple' : 'accent'} />
        {data?.limited_prior && (
          <span className="flex items-center gap-1.5 text-xs text-collapse-warn bg-collapse-warn/10 border border-collapse-warn/25 px-3 py-1.5 rounded-full">
            <AlertTriangle className="w-3 h-3"/>Limited prior — simulation only
          </span>
        )}
      </div>

      {isLoading && <div className="h-48 flex items-center justify-center text-collapse-muted text-sm">Loading…</div>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Style fingerprint */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Style Fingerprint</p>
            <div className="flex flex-wrap gap-2">
              {data.style_tags.map(t => <StyleTag key={t} tag={t} />)}
            </div>
            <p className="text-xs text-collapse-dim leading-relaxed">
              Derived from WC event data — passing patterns, pressing triggers, territory tendencies.
            </p>
          </div>

          {/* Card 2: Collapse profile */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Collapse Profile</p>
            <div className="bg-collapse-bg rounded-xl p-3 text-center">
              <p className="text-xs text-collapse-muted mb-1">Likely window</p>
              <p className="text-2xl font-bold font-mono text-collapse-warn">{data.collapse_window}</p>
            </div>
            <div className="space-y-2">
              {data.top_triggers.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-collapse-text">
                  <span className="w-4 h-4 rounded-full bg-collapse-risk/15 text-collapse-risk text-[9px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i+1}</span>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Stabilizers */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Top Stabilizers</p>
            <div className="space-y-3">
              {data.stabilizers.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-collapse-safe/5 border border-collapse-safe/20 rounded-xl px-3 py-2.5">
                  <TrendingDown className="w-3.5 h-3.5 text-collapse-safe shrink-0 mt-0.5"/>
                  <span className="text-xs text-collapse-text">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page: Matchup ──────────────────────────────────────────────────────────
const PRESS_OPTS:  [PressLevel, string][]  = [[25,'Low press'],[50,'Medium'],[75,'High press']];
const BUILD_OPTS:  [BuildStyle, string][]  = [[25,'Direct'],[50,'Mixed'],[75,'Possession']];
const TEMPO_OPTS:  [TempoCtrl, string][]   = [[25,'Fast'],[50,'Balanced'],[75,'Controlled']];

function LeverGroup<T extends number>({ label, opts, value, onChange }: { label: string; opts: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-collapse-muted font-bold uppercase tracking-wider">{label}</p>
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
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-collapse-muted shrink-0 mt-0.5"/>
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-collapse-border bg-collapse-bg/60 px-5 pb-4">
            {insight.proof_type === 'before_after'   && <BeforeAfter proof={insight.proof} />}
            {insight.proof_type === 'heatmap'        && <PitchHeatmap proof={insight.proof} />}
            {insight.proof_type === 'mini_timeline'  && <MiniTimeline proof={insight.proof} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MatchupPage({ teams }: { teams: string[] }) {
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
    <div className="space-y-6">
      {/* Team selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        <TeamSelector teams={teams} value={teamA} onChange={setTeamA} accent="accent" />
        <span className="font-bold text-collapse-border text-lg px-1">vs</span>
        <TeamSelector teams={teams} value={teamB} onChange={setTeamB} accent="purple" />
      </div>

      {(!teamA || !teamB || teamA === teamB) && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Swords className="w-10 h-10 text-collapse-border"/>
          <p className="text-collapse-muted text-sm">Select two different teams to generate the matchup</p>
        </div>
      )}

      {isLoading && <div className="h-40 flex items-center justify-center text-collapse-muted text-sm">Computing matchup…</div>}

      {data && (
        <div className="space-y-6">
          {/* ── Hero row: 3 numbers ─────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 text-center">
              <p className="text-[10px] text-collapse-muted uppercase tracking-wider mb-2">Win Range</p>
              <p className="text-3xl font-black font-mono text-collapse-accent leading-none">
                {data.win_range.low}–{data.win_range.high}<span className="text-lg font-bold">%</span>
              </p>
              <p className="text-[10px] text-collapse-dim mt-1.5">{data.team_a}</p>
            </div>
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 text-center">
              <p className="text-[10px] text-collapse-muted uppercase tracking-wider mb-2">Collapse Risk</p>
              <p className="text-3xl font-black font-mono text-collapse-risk leading-none">
                {data.collapse_range.low}–{data.collapse_range.high}<span className="text-lg font-bold">%</span>
              </p>
              <p className="text-[10px] text-collapse-dim mt-1.5">{data.team_a}</p>
            </div>
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 text-center">
              <p className="text-[10px] text-collapse-muted uppercase tracking-wider mb-2">Likely Window</p>
              <p className="text-3xl font-black font-mono text-collapse-warn leading-none">{data.collapse_window}</p>
              <p className="text-[10px] text-collapse-dim mt-1.5">Peak danger</p>
            </div>
          </div>

          {/* ── Top 2 triggers ──────────────────────────────────────────── */}
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

          {/* ── Insights (click to expand) ─────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Evidence — click to expand</p>
            {data.insights.map((ins, i) => <InsightCard key={i} insight={ins} index={i} />)}
          </div>

          {/* ── Plan levers ─────────────────────────────────────────────── */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-5">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted">Plan Levers — toggle to update above</p>
            <div className="grid grid-cols-3 gap-4">
              <LeverGroup label="Press level" opts={PRESS_OPTS}  value={press}  onChange={setPress} />
              <LeverGroup label="Build style" opts={BUILD_OPTS}  value={build}  onChange={setBuild} />
              <LeverGroup label="Tempo"       opts={TEMPO_OPTS}  value={tempo}  onChange={setTempo} />
            </div>

            {/* Best / 2nd best / don't do */}
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
function ReplayPage({ teams, tournament }: { teams: string[]; tournament: Tournament }) {
  const [team, setTeam] = useState(teams[0] ?? '');
  const [matchId, setMatchId] = useState<number | null>(null);
  const [openMoment, setOpenMoment] = useState<number | null>(null);

  const { data: matches = [] } = useQuery<{match_id:number;home:string;away:string;score:string;date:string}[]>({
    queryKey: ['team-matches', team],
    queryFn: () => get(`/api/coach/team/${encodeURIComponent(team)}/matches`),
    enabled: !!team,
  });

  const { data: replay, isLoading: replayLoading } = useQuery<MatchReplay>({
    queryKey: ['match-replay', matchId],
    queryFn: () => get(`/api/coach/match/${matchId}/replay`),
    enabled: matchId !== null,
  });

  const riskColor = (p: number) => p > 0.55 ? '#FF3B5C' : p > 0.35 ? '#F5A623' : '#0BDE8C';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <TeamSelector teams={teams} value={team} onChange={v => { setTeam(v); setMatchId(null); }} />
        {matches.length > 0 && (
          <select onChange={e => setMatchId(+e.target.value)} defaultValue=""
            className="bg-collapse-surface border border-collapse-border rounded-xl px-4 py-2.5 text-sm text-collapse-text focus:border-collapse-accent focus:outline-none min-w-[240px]">
            <option value="">Select match…</option>
            {matches.map(m => <option key={m.match_id} value={m.match_id}>{m.home} vs {m.away} — {m.score} ({m.date})</option>)}
          </select>
        )}
      </div>

      {!matchId && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Film className="w-10 h-10 text-collapse-border"/>
          <p className="text-collapse-muted text-sm">Select a team and match to load the collapse replay</p>
        </div>
      )}

      {replayLoading && <div className="h-40 flex items-center justify-center text-collapse-muted text-sm">Loading replay…</div>}

      {replay && (
        <div className="space-y-5">
          {/* Match label */}
          <div className="flex items-center justify-between bg-collapse-surface border border-collapse-border rounded-2xl px-5 py-3">
            <span className="font-semibold text-collapse-text">{replay.home} vs {replay.away}</span>
            <span className="font-black font-mono text-2xl text-collapse-accent">{replay.score}</span>
          </div>

          {/* Collapse probability timeline */}
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted mb-4">Collapse Probability Timeline</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={replay.timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF3B5C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF3B5C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="minute" tick={{ fill: '#64748B', fontSize: 10 }} interval={14}
                  tickFormatter={v => `${v}'`} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={v => `${Math.round(v*100)}%`}
                  domain={[0, 1]} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v: number) => [`${(v*100).toFixed(0)}%`, 'Risk']}
                  labelFormatter={l => `${l}'`}
                  contentStyle={{ background: '#0F1929', border: '1px solid #1C2D40', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FF3B5C' }}/>
                {replay.key_moments.filter(m => m.type === 'spike').map(m => (
                  <ReferenceLine key={m.minute} x={m.minute} stroke="#F5A623" strokeDasharray="3 2" strokeWidth={1.5}/>
                ))}
                <ReferenceLine y={0.5} stroke="#FF3B5C" strokeDasharray="4 2" strokeWidth={1} opacity={0.4}/>
                <Area type="monotone" dataKey="probability" stroke="#FF3B5C" strokeWidth={2}
                  fill="url(#riskGrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Key moments strip */}
          {replay.key_moments.length > 0 && (
            <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-collapse-muted mb-3">Key Moments — click for evidence</p>
              <div className="flex flex-wrap gap-2">
                {replay.key_moments.map((m, i) => (
                  <button key={i} onClick={() => setOpenMoment(openMoment === i ? null : i)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      openMoment === i
                        ? 'bg-collapse-warn/10 border-collapse-warn text-collapse-warn'
                        : 'bg-collapse-bg border-collapse-border text-collapse-muted hover:text-collapse-text'
                    }`}>
                    <span className="font-mono font-bold">{m.minute}'</span>
                    <span>{m.label}</span>
                    {m.delta > 0 && <span className="font-mono" style={{ color: riskColor(m.delta + 0.3) }}>+{(m.delta*100).toFixed(0)}%</span>}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {openMoment !== null && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="overflow-hidden mt-4 rounded-xl border border-collapse-warn/25 bg-collapse-warn/5 px-4 py-3">
                    <p className="text-sm font-semibold text-collapse-warn">{replay.key_moments[openMoment]?.label}</p>
                    <p className="text-xs text-collapse-muted mt-1">
                      {replay.key_moments[openMoment]?.type === 'spike'
                        ? `Collapse probability jumped ${(replay.key_moments[openMoment].delta * 100).toFixed(0)}pp — consistent with turnover cluster pattern identified in this team's fingerprint.`
                        : 'Match completed. Full event timeline available in StatsBomb data.'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
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
      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-0 border-b border-collapse-border bg-collapse-surface">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-collapse-accent to-collapse-purple flex items-center justify-center shadow-lg shadow-collapse-accent/20">
              <BrainCircuit className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Coach View</h1>
              <p className="text-xs text-collapse-muted">NeuroMomentum · {tournament === 'wc2022' ? 'WC 2022 event data' : 'WC 2026 simulation using 2022 priors'}</p>
            </div>
          </div>
          <TournamentPicker value={tournament} onChange={setTournament} />
        </div>

        {/* Page nav */}
        <div className="flex gap-1">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                page === id
                  ? 'border-collapse-accent text-collapse-accent bg-collapse-accent/5'
                  : 'border-transparent text-collapse-muted hover:text-collapse-text'
              }`}>
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — one page, one decision */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {page === 'home'    && <TeamPage teams={teams} tournament={tournament} mode="home" />}
        {page === 'scout'   && <TeamPage teams={teams} tournament={tournament} mode="scout" />}
        {page === 'matchup' && <MatchupPage teams={teams} />}
        {page === 'replay'  && <ReplayPage teams={teams} tournament={tournament} />}
      </div>
    </div>
  );
}
