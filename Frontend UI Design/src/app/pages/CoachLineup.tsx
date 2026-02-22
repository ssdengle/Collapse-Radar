import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, X, Plus, AlertTriangle, TrendingUp, Shield, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ForceGraph2D from 'react-force-graph-2d';

const API_BASE = 'http://127.0.0.1:8000';
const get = (url: string) => fetch(`${API_BASE}${url}`).then(r => r.json());
const post = (url: string, body: unknown) =>
  fetch(`${API_BASE}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

type Tournament = 'wc2022' | 'wc2026';

interface Player {
  id: number;
  name: string;
  pos: string;
  load: number;      // 0–100  (stability load)
  influence: number; // 0–10
}

interface Edge { source: string; target: string; weight: number; }

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }

function loadColor(load: number) {
  const x = clamp(load, 0, 100);
  if (x < 60) return '#22c55e';
  if (x < 80) return '#f59e0b';
  return '#ef4444';
}

function loadLabel(load: number) {
  if (load < 60) return { text: 'STABLE', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (load < 80) return { text: 'CAUTION', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  return { text: 'HIGH RISK', cls: 'text-red-400 bg-red-500/10 border-red-500/20' };
}

const POS_ORDER = ['GK','RB','CB','LB','CDM','CM','CAM','RW','LW','ST','CF'];
function posOrder(pos: string) { const i = POS_ORDER.indexOf(pos); return i < 0 ? 99 : i; }

// ── Player card ─────────────────────────────────────────────────────────────
function PlayerCard({ player, inXI, onToggle }: { player: Player; inXI: boolean; onToggle: () => void }) {
  const { text, cls } = loadLabel(player.load);
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-xl border transition-all p-3 ${inXI ? 'border-collapse-accent/30 bg-collapse-accent/5' : 'border-collapse-border bg-collapse-surface'}`}>
      <div className="flex items-start gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-collapse-text truncate">{player.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-collapse-border/60 text-collapse-muted">{player.pos}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{text}</span>
          </div>
        </div>
        <button onClick={onToggle}
          className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
            inXI ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-collapse-accent/10 border-collapse-accent/30 text-collapse-accent hover:bg-collapse-accent/20'
          }`}>
          {inXI ? <X className="w-3.5 h-3.5"/> : <Plus className="w-3.5 h-3.5"/>}
        </button>
      </div>

      {/* Stability load bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-collapse-muted">Stability Load</span>
          <span className="font-mono font-bold" style={{ color: loadColor(player.load) }}>{Math.round(player.load)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-collapse-border overflow-hidden">
          <motion.div className="h-full rounded-full"
            initial={{ width: 0 }} animate={{ width: `${player.load}%` }} transition={{ duration: 0.5, delay: 0.1 }}
            style={{ background: loadColor(player.load) }}/>
        </div>
      </div>

      {/* Influence */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-collapse-dim">Influence</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-sm" style={{
              background: i < Math.round(player.influence) ? '#0EA5E9' : '#1C2D40'
            }}/>
          ))}
          <span className="text-[10px] font-mono text-collapse-accent ml-1">{player.influence.toFixed(1)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Risk delta badge ─────────────────────────────────────────────────────────
function RiskDelta({ base, adjusted, missing }: { base: number; adjusted: number; missing: number }) {
  const delta = adjusted - base;
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
      missing > 3 ? 'border-red-500/30 bg-red-500/5' : missing > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
    }`}>
      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${missing > 3 ? 'text-red-400' : missing > 0 ? 'text-amber-400' : 'text-emerald-400'}`}/>
      <div className="flex-1">
        <p className="text-xs font-semibold text-collapse-text">Collapse Risk Delta</p>
        <p className="text-[10px] text-collapse-muted mt-0.5">
          Base: <span className="font-mono font-bold text-collapse-text">{(base * 100).toFixed(0)}%</span>
          {' → '}
          <span className="font-mono font-bold" style={{ color: delta > 0.05 ? '#ef4444' : delta > 0 ? '#f59e0b' : '#22c55e' }}>
            {(adjusted * 100).toFixed(0)}%
          </span>
          {delta > 0 && <span className="text-red-400 ml-1">(+{(delta * 100).toFixed(0)}pp — {missing} slot{missing !== 1 ? 's' : ''} unfilled)</span>}
          {delta === 0 && <span className="text-emerald-400 ml-1"> — Full XI selected</span>}
        </p>
      </div>
    </div>
  );
}

// ── Force graph wrapper ──────────────────────────────────────────────────────
function PassNetwork({ players, edges }: { players: Player[]; edges: Edge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const nameSet = new Set(players.map(p => p.name));
    return {
      nodes: players.map(p => ({ id: p.name, name: p.name, pos: p.pos, load: p.load, influence: p.influence })),
      links: edges
        .filter(e => nameSet.has(e.source) && nameSet.has(e.target))
        .map(e => ({ source: e.source, target: e.target, value: e.weight })),
    };
  }, [players, edges]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = 3 + node.influence * 1.2;
    const col = loadColor(node.load);

    // Outer ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
    ctx.fillStyle = col + '22';
    ctx.fill();

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = col + 'CC';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Position tag
    const fontSize = Math.max(8, 9 / globalScale);
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(node.pos, node.x, node.y);

    // Name label below
    const labelSize = Math.max(7, 8 / globalScale);
    ctx.font = `${labelSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.fillText(node.name, node.x, node.y + r + labelSize + 2);
  }, []);

  if (players.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-collapse-surface border border-collapse-border flex items-center justify-center">
          <Users className="w-6 h-6 text-collapse-border"/>
        </div>
        <p className="text-sm text-collapse-muted">Add players to see the pass network</p>
        <p className="text-xs text-collapse-dim max-w-xs">Node size = influence · Node color = stability load</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ForceGraph2D
        width={dims.w} height={dims.h}
        graphData={graphData}
        backgroundColor="transparent"
        nodeLabel={(n: any) => `${n.name} (${n.pos}) — Load: ${Math.round(n.load)}% · Influence: ${n.influence}`}
        nodeVal={(n: any) => n.influence}
        linkWidth={(l: any) => Math.max(0.5, (l.value || 1) / 8)}
        linkColor={() => 'rgba(148,163,184,0.25)'}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.3}
        cooldownTime={2000}
      />
    </div>
  );
}

// ── Dropdown ─────────────────────────────────────────────────────────────────
function Dropdown({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none bg-collapse-surface border border-collapse-border rounded-xl px-4 py-2.5 pr-9 text-sm text-collapse-text focus:border-collapse-accent focus:outline-none cursor-pointer min-w-[160px]">
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-collapse-muted">▾</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function CoachLineup() {
  const [tournament] = useState<Tournament>('wc2022');
  const [team, setTeam] = useState('');
  const [opponent, setOpponent] = useState('');
  const [xi, setXi] = useState<Set<number>>(new Set());

  const { data: teams = [] } = useQuery<string[]>({
    queryKey: ['coach-teams', tournament],
    queryFn: () => get(`/api/coach/teams?tournament=${tournament}`),
  });

  const { data: squadData, isLoading: squadLoading } = useQuery<{ players: Player[]; edges: Edge[] }>({
    queryKey: ['lineup-squad', team, tournament],
    queryFn: () => get(`/api/coach/lineup/squad?team=${encodeURIComponent(team)}&tournament=${tournament}`),
    enabled: !!team,
  });

  const { data: oppData } = useQuery<{ players: Player[]; edges: Edge[] }>({
    queryKey: ['lineup-squad', opponent, tournament],
    queryFn: () => get(`/api/coach/lineup/squad?team=${encodeURIComponent(opponent)}&tournament=${tournament}`),
    enabled: !!opponent,
  });

  const { mutate: evaluate, data: riskData } = useMutation<any, Error, { team: string; player_names: string[] }>({
    mutationFn: body => post('/api/coach/lineup/evaluate', body),
  });

  // Re-evaluate whenever XI changes
  useEffect(() => {
    if (!team || !squadData) return;
    const names = squadData.players.filter(p => xi.has(p.id)).map(p => p.name);
    evaluate({ team, player_names: names });
  }, [xi, team, squadData]);

  // Reset XI when team changes
  useEffect(() => { setXi(new Set()); }, [team]);

  const allPlayers = squadData?.players ?? [];
  const sortedPlayers = [...allPlayers].sort((a, b) => posOrder(a.pos) - posOrder(b.pos));
  const xiPlayers = sortedPlayers.filter(p => xi.has(p.id));
  const benchPlayers = sortedPlayers.filter(p => !xi.has(p.id));

  function togglePlayer(id: number) {
    setXi(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < 11) next.add(id);
      return next;
    });
  }

  const avgLoad   = xiPlayers.length ? xiPlayers.reduce((s, p) => s + p.load, 0) / xiPlayers.length : 0;
  const highRisk  = xiPlayers.filter(p => p.load >= 80).length;

  return (
    <div className="h-full flex flex-col bg-collapse-bg text-collapse-text overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-0 border-b border-collapse-border bg-collapse-surface">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-collapse-accent to-collapse-purple flex items-center justify-center shadow-lg shadow-collapse-accent/20">
              <Users className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Lineup Builder</h1>
              <p className="text-xs text-collapse-muted">Build your Starting XI · visualise pass influence network</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dropdown options={teams} value={team} onChange={v => { setTeam(v); if (v === opponent) setOpponent(''); }} placeholder="Your team…"/>
            <span className="text-collapse-muted text-sm font-medium">vs</span>
            <Dropdown options={teams.filter(t => t !== team)} value={opponent} onChange={setOpponent} placeholder="Opponent…"/>
          </div>
        </div>
      </div>

      {/* Body */}
      {!team ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-collapse-surface border border-collapse-border flex items-center justify-center">
            <Users className="w-7 h-7 text-collapse-border"/>
          </div>
          <div>
            <p className="text-collapse-text font-medium mb-1">Select a team to start</p>
            <p className="text-collapse-muted text-sm max-w-sm">Pick your team from the top selector, then add players to build your Starting XI. The network updates live as you pick.</p>
          </div>
        </div>
      ) : squadLoading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-collapse-muted text-sm">
          <RefreshCw className="w-4 h-4 animate-spin"/>Loading squad…
        </div>
      ) : (
        <div className="flex-1 overflow-hidden grid grid-cols-[380px_1fr] min-h-0">
          {/* Left column — player cards */}
          <div className="border-r border-collapse-border flex flex-col overflow-hidden">
            {/* XI summary bar */}
            <div className="shrink-0 px-4 py-3 border-b border-collapse-border bg-collapse-surface/50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-collapse-text">Starting XI — {xi.size}/11</p>
                {xi.size > 0 && (
                  <button onClick={() => setXi(new Set())} className="text-[10px] text-collapse-muted hover:text-collapse-text transition-colors">Clear all</button>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 h-1.5 rounded-full bg-collapse-border overflow-hidden">
                  <div className="h-full bg-collapse-accent rounded-full transition-all" style={{ width: `${(xi.size / 11) * 100}%` }}/>
                </div>
                <span className="text-[10px] font-mono text-collapse-muted">{11 - xi.size} to go</span>
              </div>
              {xi.size > 0 && (
                <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-collapse-accent"/>
                    <span className="text-[10px] text-collapse-muted">Avg load <span className="font-bold" style={{ color: loadColor(avgLoad) }}>{avgLoad.toFixed(0)}%</span></span>
                  </div>
                  {highRisk > 0 && (
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-red-400"/>
                      <span className="text-[10px] text-red-400 font-medium">{highRisk} high-risk player{highRisk !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              )}
              {riskData && <div className="mt-2"><RiskDelta base={riskData.base_risk} adjusted={riskData.adjusted_risk} missing={riskData.missing_count}/></div>}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
              {/* Starting XI */}
              {xiPlayers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-collapse-accent mb-2">Starting XI</p>
                  <AnimatePresence>
                    {xiPlayers.map(p => (
                      <div key={p.id} className="mb-2">
                        <PlayerCard player={p} inXI={true} onToggle={() => togglePlayer(p.id)}/>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Available squad */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-collapse-muted mb-2">
                  Available — {benchPlayers.length} players {xi.size >= 11 && <span className="text-amber-400">(XI full)</span>}
                </p>
                <AnimatePresence>
                  {benchPlayers.map(p => (
                    <div key={p.id} className="mb-2">
                      <PlayerCard player={p} inXI={false} onToggle={() => togglePlayer(p.id)}/>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right — pass network */}
          <div className="flex flex-col overflow-hidden">
            <div className="shrink-0 px-5 py-3 border-b border-collapse-border bg-collapse-surface/50 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-collapse-text">Pass Influence Network</p>
                <p className="text-[10px] text-collapse-muted mt-0.5">
                  Node size = influence · Node color = stability load
                  <span className="ml-2 inline-flex gap-2">
                    <span className="text-emerald-400">● Stable</span>
                    <span className="text-amber-400">● Caution</span>
                    <span className="text-red-400">● High risk</span>
                  </span>
                </p>
              </div>
              {opponent && oppData && (
                <div className="text-right">
                  <p className="text-[10px] text-collapse-muted">vs <span className="text-collapse-text font-medium">{opponent}</span></p>
                  <p className="text-[10px] text-collapse-dim">
                    Opp avg load: <span className="font-mono" style={{ color: loadColor(oppData.players.reduce((s,p) => s + p.load,0) / (oppData.players.length||1)) }}>
                      {(oppData.players.reduce((s,p) => s + p.load,0) / (oppData.players.length||1)).toFixed(0)}%
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <PassNetwork players={xiPlayers} edges={squadData?.edges ?? []}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
