import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { Users, X, Plus, AlertTriangle, TrendingUp, Shield, RefreshCw, Medal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

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
  // Use rounded value so color bucket matches displayed % label.
  const x = Math.round(clamp(load, 0, 100));
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

const POS_X_PREF: Record<string, number> = {
  // Back line
  LB: 12, CB: 50, RB: 88,
  // Midfield spine
  CDM: 50, DM: 50, CM: 50, CAM: 50, MF: 50,
  // Front line
  LW: 16, RW: 84, ST: 50, CF: 50,
  // Keeper
  GK: 50,
};

function spreadSameLane(center: number, count: number) {
  if (count <= 1) return [center];
  const step = 24;
  const out: number[] = [];
  const start = -((count - 1) / 2) * step;
  for (let i = 0; i < count; i++) out.push(center + start + i * step);
  return out.map(x => clamp(x, 8, 92));
}

function getShortNameMap(players: Player[]) {
  const lastCounts: Record<string, number> = {};
  players.forEach(p => {
    const parts = p.name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    lastCounts[last] = (lastCounts[last] ?? 0) + 1;
  });
  const out: Record<string, string> = {};
  players.forEach(p => {
    const parts = p.name.trim().split(/\s+/);
    const first = parts[0] ?? p.name;
    const last = parts[parts.length - 1] ?? p.name;
    out[p.name] = (lastCounts[last] ?? 0) > 1 ? `${first[0]}. ${last}` : last;
  });
  return out;
}

// ── Player card ─────────────────────────────────────────────────────────────
function PlayerCard({
  player, inXI, onToggle, dragHandlers, isDragOver, isDragging,
}: {
  player: Player; inXI: boolean; onToggle: () => void;
  dragHandlers?: {
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
  isDragOver?: boolean; isDragging?: boolean;
}) {
  const { text, cls } = loadLabel(player.load);
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={dragHandlers?.onDragStart}
      onDragOver={dragHandlers?.onDragOver}
      onDragEnter={dragHandlers?.onDragEnter}
      onDrop={dragHandlers?.onDrop}
      onDragEnd={dragHandlers?.onDragEnd}
      className={`rounded-xl border transition-all p-3 cursor-grab active:cursor-grabbing ${
        isDragOver ? 'border-collapse-accent bg-collapse-accent/10 ring-1 ring-collapse-accent/50 scale-[1.02]' :
        isDragging  ? 'opacity-40 border-collapse-border' :
        inXI ? 'border-collapse-accent/30 bg-collapse-accent/5' : 'border-collapse-border bg-collapse-surface'
      }`}>
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
  const svgRef = useRef<SVGSVGElement>(null);
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

  const { nodes, links } = useMemo(() => {
    const coords = getFormationCoords(players);
    const byName: Record<string, { x: number; y: number; p: Player }> = {};
    coords.forEach(({ player, xPct, yPct }) => {
      byName[player.name] = {
        x: (xPct / 100) * dims.w,
        y: (yPct / 100) * dims.h,
        p: player,
      };
    });
    const nameSet = new Set(Object.keys(byName));

    // Collapse duplicate undirected links to a single stronger link.
    const linkMap = new Map<string, { source: string; target: string; value: number }>();
    edges.forEach(e => {
      if (!nameSet.has(e.source) || !nameSet.has(e.target)) return;
      const [a, b] = e.source < e.target ? [e.source, e.target] : [e.target, e.source];
      const key = `${a}__${b}`;
      const prev = linkMap.get(key);
      if (!prev || e.weight > prev.value) linkMap.set(key, { source: a, target: b, value: e.weight });
    });

    return {
      nodes: Object.entries(byName).map(([name, v]) => ({ id: name, ...v })),
      links: Array.from(linkMap.values()),
    };
  }, [players, edges, dims]);

  // Keep the network alive with subtle tactical movement (not chaotic physics).
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase(p => p + 0.055), 33);
    return () => window.clearInterval(id);
  }, []);

  const [manualPos, setManualPos] = useState<Record<string, { x: number; y: number }>>({});
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);

  const pointFromEvent = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * dims.w;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * dims.h;
    return { x, y };
  };

  const animated = useMemo(() => {
    const byId = new Map<string, { x: number; y: number; p: Player }>();
    nodes.forEach((n, idx) => {
      const fixed = manualPos[n.id];
      if (fixed) {
        byId.set(n.id, { ...n, x: fixed.x, y: fixed.y });
        return;
      }
      const baseAmp = 2.5 + (n.p.influence / 10) * 2.5; // 2.5..5px
      const seed = (idx + 1) * 0.71;
      const dx = Math.sin(phase + seed) * baseAmp;
      const dy = Math.cos(phase * 0.85 + seed * 1.3) * (baseAmp * 0.7);
      byId.set(n.id, { ...n, x: n.x + dx, y: n.y + dy });
    });
    return byId;
  }, [nodes, phase, manualPos]);

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

  const shortNames = getShortNameMap(players);
  return (
    <div ref={containerRef} className="h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${Math.max(1, dims.w)} ${Math.max(1, dims.h)}`}
        className="w-full h-full"
        onMouseMove={e => {
          if (!dragNodeId) return;
          const p = pointFromEvent(e);
          setManualPos(prev => ({ ...prev, [dragNodeId]: p }));
        }}
        onMouseUp={() => setDragNodeId(null)}
        onMouseLeave={() => setDragNodeId(null)}
      >
        {/* Links */}
        {links.map((l, i) => {
          const s = animated.get(l.source);
          const t = animated.get(l.target);
          if (!s || !t) return null;
          const strokeW = 0.8 + (l.value / 10) * 2.8;
          const opacity = 0.16 + (l.value / 10) * 0.42;
          return (
            <line
              key={`${l.source}-${l.target}-${i}`}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={`rgba(125,211,252,${opacity.toFixed(3)})`}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
          );
        })}

        {/* Nodes */}
        {Array.from(animated.values()).map(n => {
          const r = 14 + n.p.influence * 1.55;
          const col = loadColor(n.p.load);
          return (
            <g
              key={n.id}
              onMouseDown={e => {
                e.preventDefault();
                setDragNodeId(n.id);
                const p = pointFromEvent(e as unknown as React.MouseEvent<SVGSVGElement>);
                setManualPos(prev => ({ ...prev, [n.id]: p }));
              }}
              style={{ cursor: dragNodeId === n.id ? 'grabbing' : 'grab' }}
            >
              <circle cx={n.x} cy={n.y} r={r + 5} fill={col} opacity="0.14" />
              <circle cx={n.x} cy={n.y} r={r} fill={col} opacity="0.92" stroke={col} strokeWidth="2" />
              <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="13" fontWeight="800">
                {n.p.pos}
              </text>
              <text x={n.x} y={n.y + r + 15} textAnchor="middle" fill="rgba(226,232,240,0.95)" fontSize="11" fontWeight="600">
                {shortNames[n.p.name]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Pitch Formation view ─────────────────────────────────────────────────────
const POS_ROW: Record<string, number> = {
  GK: 0, LB: 1, CB: 1, RB: 1,
  CDM: 2, DM: 2, CM: 3, CAM: 4,
  LW: 5, RW: 5, ST: 5, CF: 5, MF: 3,
};
// Y% on pitch per row — GK at bottom (defend side), attackers at top (attack side)
// Row 0=GK → y=86%, Row 5=ATT → y=12%
const ROW_Y_PCT = [86, 74, 62, 50, 38, 24, 12];

function getFormationCoords(players: Player[]) {
  const rows: Record<number, Player[]> = {};
  for (const p of players) {
    const row = POS_ROW[p.pos] ?? 3;
    if (!rows[row]) rows[row] = [];
    rows[row].push(p);
  }
  const result: { player: Player; xPct: number; yPct: number; row: number }[] = [];
  for (const [rowStr, rp] of Object.entries(rows)) {
    const row = Number(rowStr);
    const yPct = ROW_Y_PCT[row] ?? 50;
    const byPref = [...rp].sort((a, b) => (POS_X_PREF[a.pos] ?? 50) - (POS_X_PREF[b.pos] ?? 50));

    // Group players that share the same lane preference (e.g. two CBs, two CMs).
    const laneGroups: Record<number, Player[]> = {};
    byPref.forEach(p => {
      const pref = POS_X_PREF[p.pos] ?? 50;
      (laneGroups[pref] = laneGroups[pref] || []).push(p);
    });

    Object.entries(laneGroups).forEach(([prefStr, group]) => {
      const pref = Number(prefStr);
      const xs = spreadSameLane(pref, group.length);
      group.forEach((p, i) => {
        result.push({ player: p, xPct: xs[i], yPct, row });
      });
    });
  }
  return result;
}

function getFormationName(players: Player[]) {
  const counts: Record<number, number> = {};
  for (const p of players) {
    const row = POS_ROW[p.pos] ?? 3;
    if (row > 0) counts[row] = (counts[row] ?? 0) + 1;
  }
  // Read defense → attack: row 1 (defenders) first, row 5 (attackers) last
  const rows = Object.keys(counts).map(Number).sort((a, b) => a - b);
  return rows.map(r => counts[r]).join('-');
}

function PitchFormation({ players, onToggle }: { players: Player[]; onToggle: (id: number) => void }) {
  const VW = 420; const VH = 640;
  const px = (x: number) => (x / 100) * VW;
  const py = (y: number) => (y / 100) * VH;

  if (players.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-collapse-surface border border-collapse-border flex items-center justify-center">
          <Users className="w-6 h-6 text-collapse-border"/>
        </div>
        <p className="text-sm text-collapse-muted">Add players to see the formation</p>
        <p className="text-xs text-collapse-dim max-w-xs">Players will appear in their tactical position on the pitch</p>
      </div>
    );
  }

  const coords = getFormationCoords(players);
  const formation = getFormationName(players);
  const shortNames = getShortNameMap(players);

  // Group coords by row for drawing connecting lines
  const byRow: Record<number, typeof coords> = {};
  for (const c of coords) {
    if (!byRow[c.row]) byRow[c.row] = [];
    byRow[c.row].push(c);
  }

  return (
    <div className="flex flex-col items-center h-full py-3 gap-2">
      {/* Formation label */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-collapse-muted uppercase tracking-wider">Formation</span>
        <span className="text-xs font-black font-mono text-collapse-accent">{formation}</span>
        <span className="text-[10px] text-collapse-dim">· click player to remove</span>
      </div>

      <svg viewBox={`0 0 ${VW} ${VH}`} className="flex-1 max-h-[620px] w-auto">
        {/* Grass stripes */}
        {Array.from({length: 8}, (_,i) => (
          <rect key={i} x="0" y={i*(VH/8)} width={VW} height={VH/8}
            fill={i%2===0 ? '#0d2318' : '#0b1e15'}/>
        ))}
        <rect width={VW} height={VH} fill="none" stroke="#1e5c35" strokeWidth="2"/>

        {/* Pitch lines */}
        {/* Halfway */}
        <line x1="0" y1={VH/2} x2={VW} y2={VH/2} stroke="#1e5c35" strokeWidth="1.2"/>
        {/* Centre circle */}
        <circle cx={VW/2} cy={VH/2} r="36" fill="none" stroke="#1e5c35" strokeWidth="1.2"/>
        <circle cx={VW/2} cy={VH/2} r="2.5" fill="#1e5c35"/>
        {/* Top box */}
        <rect x={px(18)} y="0" width={px(64)} height={py(16)} fill="none" stroke="#1e5c35" strokeWidth="1.2"/>
        <rect x={px(31)} y="0" width={px(38)} height={py(7)} fill="none" stroke="#1e5c35" strokeWidth="1.2"/>
        {/* Bottom box */}
        <rect x={px(18)} y={VH-py(16)} width={px(64)} height={py(16)} fill="none" stroke="#1e5c35" strokeWidth="1.2"/>
        <rect x={px(31)} y={VH-py(7)} width={px(38)} height={py(7)} fill="none" stroke="#1e5c35" strokeWidth="1.2"/>
        {/* Goals */}
        <rect x={px(36)} y={-4} width={px(28)} height="6" fill="none" stroke="#1e5c35" strokeWidth="1.2"/>
        <rect x={px(36)} y={VH-2} width={px(28)} height="6" fill="none" stroke="#1e5c35" strokeWidth="1.2"/>
        {/* Penalty spots */}
        <circle cx={VW/2} cy={py(11)} r="2" fill="#1e5c35"/>
        <circle cx={VW/2} cy={VH-py(11)} r="2" fill="#1e5c35"/>

        {/* Horizontal row connections (within each row, e.g. defensive line) */}
        {Object.values(byRow).map((rowCoords, ri) => {
          if (rowCoords.length < 2) return null;
          const sorted = [...rowCoords].sort((a,b) => a.xPct - b.xPct);
          return sorted.slice(0, -1).map((c, i) => (
            <line key={`h-${ri}-${i}`}
              x1={px(c.xPct)} y1={py(c.yPct)}
              x2={px(sorted[i+1].xPct)} y2={py(sorted[i+1].yPct)}
              stroke="rgba(100,210,255,0.5)" strokeWidth="2" strokeDasharray="5 3"/>
          ));
        })}

        {/* Diagonal connections between adjacent rows (e.g. each CB → CDM, CDM → each CM) */}
        {(() => {
          const rowKeys = Object.keys(byRow).map(Number).sort((a,b) => a - b);
          const lines: React.ReactNode[] = [];
          rowKeys.slice(0, -1).forEach((row, ri) => {
            const nextRow = rowKeys[ri + 1];
            const upper = byRow[nextRow]; // closer to attack
            const lower = byRow[row];    // closer to defend
            // Connect each lower node to the nearest upper node
            lower.forEach((lc, li) => {
              const nearest = [...upper].sort((a, b) =>
                Math.abs(a.xPct - lc.xPct) - Math.abs(b.xPct - lc.xPct)
              ).slice(0, Math.ceil(upper.length / 2));
              nearest.forEach((uc, ui) => {
                lines.push(
                  <line key={`d-${ri}-${li}-${ui}`}
                    x1={px(lc.xPct)} y1={py(lc.yPct)}
                    x2={px(uc.xPct)} y2={py(uc.yPct)}
                    stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"/>
                );
              });
            });
          });
          return lines;
        })()}

        {/* Player nodes */}
        {coords.map(({ player: p, xPct, yPct }) => {
          const col = loadColor(p.load);
          const x = px(xPct); const y = py(yPct);
          return (
            <g key={p.id} onClick={() => onToggle(p.id)} style={{ cursor: 'pointer' }}>
              {/* Shadow */}
              <circle cx={x+1} cy={y+2} r="20" fill="rgba(0,0,0,0.4)"/>
              {/* Outer glow */}
              <circle cx={x} cy={y} r="24" fill={col} opacity="0.15"/>
              {/* Jersey circle */}
              <circle cx={x} cy={y} r="20" fill={col} opacity="0.9"/>
              {/* Inner highlight */}
              <circle cx={x-4} cy={y-4} r="4" fill="rgba(255,255,255,0.15)"/>
              {/* Position text */}
              <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="8.5" fontWeight="800" letterSpacing="0.3">{p.pos}</text>
              {/* Name */}
              <text x={x} y={y+29} textAnchor="middle"
                fill="rgba(255,255,255,0.95)" fontSize="8.5" fontWeight="600">{shortNames[p.name]}</text>
              {/* Load pill */}
              <rect x={x-14} y={y+35} width="28" height="10" rx="5" fill="rgba(0,0,0,0.5)"/>
              <text x={x} y={y+43} textAnchor="middle"
                fill={col} fontSize="7.2" fontWeight="800">{Math.round(p.load)}%</text>
            </g>
          );
        })}

        {/* Direction labels — ATTACK at top (attackers row), DEFEND at bottom (GK row) */}
        <text x={VW/2} y="9" textAnchor="middle" fill="#2d7a50" fontSize="7" letterSpacing="3" fontWeight="bold">▲ ATTACK</text>
        <text x={VW/2} y={VH-3} textAnchor="middle" fill="#2d7a50" fontSize="7" letterSpacing="3" fontWeight="bold">▼ DEFEND</text>
      </svg>
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

// ── Risk comparison chart ────────────────────────────────────────────────────
function RiskComparison({ team, adjustedRisk, tournament }: { team: string; adjustedRisk: number | null; tournament: Tournament }) {
  const { data: teamRisk } = useQuery<any>({
    queryKey: ['team-risk-all'],
    queryFn: () => get('/api/dashboard/team_risk'),
  });

  const rows: { team: string; risk: number; isMe: boolean }[] = useMemo(() => {
    if (!teamRisk || !Array.isArray(teamRisk)) return [];
    return [...teamRisk]
      .map((t: any) => ({ team: t.team, risk: t.avg_risk, isMe: t.team === team }))
      .sort((a, b) => a.risk - b.risk);
  }, [teamRisk, team]);

  if (!rows.length) return <div className="h-32 flex items-center justify-center text-collapse-muted text-xs">Loading comparison…</div>;

  const myRisk = adjustedRisk ?? rows.find(r => r.isMe)?.risk ?? null;
  const rank   = myRisk !== null ? rows.filter(r => r.risk < myRisk).length + 1 : null;
  const total  = rows.length;
  const better = rank !== null ? total - rank : null;

  const chartData = rows.map(r => ({
    team: r.team.length > 10 ? r.team.slice(0, 10) + '…' : r.team,
    fullTeam: r.team,
    risk: Math.round(r.risk * 100),
    isMe: r.isMe,
  }));

  return (
    <div className="space-y-4">
      {/* Rank summary */}
      {rank !== null && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-collapse-surface border border-collapse-border rounded-xl px-4 py-3">
            <p className="text-2xl font-black font-mono text-collapse-accent">#{rank}</p>
            <p className="text-[10px] text-collapse-muted uppercase tracking-wide mt-0.5">Stability rank</p>
            <p className="text-[10px] text-collapse-dim mt-1">of {total} teams · lower is more stable</p>
          </div>
          <div className="bg-collapse-surface border border-collapse-border rounded-xl px-4 py-3">
            <p className={`text-2xl font-black font-mono ${myRisk! >= 0.55 ? 'text-red-400' : myRisk! >= 0.35 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {Math.round(myRisk! * 100)}%
            </p>
            <p className="text-[10px] text-collapse-muted uppercase tracking-wide mt-0.5">Lineup risk</p>
            <p className="text-[10px] text-collapse-dim mt-1">{adjustedRisk ? 'adjusted for unfilled slots' : 'tournament baseline'}</p>
          </div>
          <div className="bg-collapse-surface border border-collapse-border rounded-xl px-4 py-3">
            <p className={`text-2xl font-black font-mono ${(better ?? 0) >= total * 0.6 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {better}
            </p>
            <p className="text-[10px] text-collapse-muted uppercase tracking-wide mt-0.5">Teams more exposed</p>
            <p className="text-[10px] text-collapse-dim mt-1">higher collapse risk than {team}</p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-collapse-text">All Teams — Collapse Risk</p>
            <p className="text-[10px] text-collapse-muted mt-0.5">Sorted low → high · lower = more stable · your team highlighted</p>
          </div>
          {myRisk !== null && (
            <div className="text-right">
              <p className="text-[10px] text-collapse-dim">Your lineup</p>
              <p className="text-xs font-mono font-bold text-collapse-accent">{Math.round(myRisk * 100)}% avg risk</p>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 40 }} barSize={14}>
            <XAxis dataKey="team" tick={{ fill: '#64748B', fontSize: 8 }} angle={-45} textAnchor="end" interval={0} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill: '#64748B', fontSize: 9 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} domain={[0, 80]}/>
            <Tooltip
              contentStyle={{ background: 'rgba(10,18,40,0.97)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(v: number, _: string, props: any) => [`${v}%`, props.payload.fullTeam]}
              labelFormatter={() => ''}/>
            {myRisk !== null && (
              <ReferenceLine y={Math.round(myRisk * 100)} stroke="#0EA5E9" strokeDasharray="4 2" strokeWidth={1.5}
                label={{ value: `${team} lineup`, fill: '#0EA5E9', fontSize: 8, position: 'insideTopRight' }}/>
            )}
            <Bar dataKey="risk" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.isMe ? '#0EA5E9' : d.risk >= 55 ? '#FF3B5C' : d.risk >= 35 ? '#F5A623' : '#22c55e'} opacity={d.isMe ? 1 : 0.65}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-collapse-dim mt-2">
          <span className="text-collapse-accent font-medium">Blue = {team}</span> · <span className="text-red-400">Red = HIGH (&gt;55%)</span> · <span className="text-amber-400">Amber = MED</span> · <span className="text-emerald-400">Green = LOW</span>
        </p>
      </div>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────
export function CoachLineup() {
  const location = useLocation();
  const locState = (location.state as any) ?? {};

  const [tournament, setTournament] = useState<Tournament>(locState.tournament ?? 'wc2022');
  const [team, setTeam] = useState(locState.team ?? '');
  const [opponent, setOpponent] = useState('');
  const [xi, setXi] = useState<Set<number>>(new Set());
  const [rightTab, setRightTab] = useState<'formation' | 'network' | 'compare'>('formation');

  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

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

  function handleDrop(sourceId: number | null, targetId: number) {
    if (sourceId === null || sourceId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const srcInXI = xi.has(sourceId);
    const tgtInXI = xi.has(targetId);
    setXi(prev => {
      const next = new Set(prev);
      if (srcInXI && !tgtInXI) {
        // Swap: take src out of XI, put target in XI
        next.delete(sourceId); next.add(targetId);
      } else if (!srcInXI && tgtInXI) {
        // Swap: take target out of XI, put src in XI
        next.delete(targetId); next.add(sourceId);
      } else if (!srcInXI && !tgtInXI && next.size < 11) {
        // Both on bench, add the dragged one if space
        next.add(sourceId);
      }
      return next;
    });
    setDraggingId(null); setDragOverId(null);
  }

  function makeDragHandlers(id: number) {
    return {
      onDragStart: (e: React.DragEvent) => {
        setDraggingId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(id));
      },
      onDragOver:  (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(id); },
      onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setDragOverId(id); },
      onDrop:      (e: React.DragEvent) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('text/plain');
        const sourceId = raw ? Number(raw) : draggingId;
        handleDrop(Number.isFinite(sourceId) ? sourceId : null, id);
      },
      onDragEnd:   () => { setDraggingId(null); setDragOverId(null); },
    };
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Lineup Builder</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${
                  tournament === 'wc2026' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-collapse-accent/10 text-collapse-accent border-collapse-accent/20'
                }`}>{tournament === 'wc2026' ? 'WC 2026 Sim' : 'WC 2022'}</span>
              </div>
              <p className="text-xs text-collapse-muted">Build Starting XI · pass network · risk vs all teams</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={tournament} onChange={e => { setTournament(e.target.value as Tournament); setTeam(''); setXi(new Set()); }}
              className="appearance-none bg-collapse-surface border border-collapse-border rounded-xl px-3 py-2 text-xs text-collapse-text focus:border-collapse-accent focus:outline-none cursor-pointer">
              <option value="wc2022">WC 2022</option>
              <option value="wc2026">WC 2026 Sim</option>
            </select>
            <Dropdown options={teams} value={team} onChange={v => { setTeam(v); if (v === opponent) setOpponent(''); }} placeholder="Your team…"/>
            <span className="text-collapse-muted text-sm font-medium">vs</span>
            <Dropdown options={teams.filter(t => t !== team)} value={opponent} onChange={setOpponent} placeholder="Opponent (optional)…"/>
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
                        <PlayerCard player={p} inXI={true} onToggle={() => togglePlayer(p.id)}
                          dragHandlers={makeDragHandlers(p.id)}
                          isDragOver={dragOverId === p.id} isDragging={draggingId === p.id}/>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Available squad */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-collapse-muted mb-2">
                  Bench — {benchPlayers.length} players {xi.size >= 11 && <span className="text-amber-400">(XI full)</span>}
                </p>
                <AnimatePresence>
                  {benchPlayers.map(p => (
                    <div key={p.id} className="mb-2">
                      <PlayerCard player={p} inXI={false} onToggle={() => togglePlayer(p.id)}
                        dragHandlers={makeDragHandlers(p.id)}
                        isDragOver={dragOverId === p.id} isDragging={draggingId === p.id}/>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right — tabs: Network / Compare */}
          <div className="flex flex-col overflow-hidden">
            {/* Tab header */}
            <div className="shrink-0 px-5 border-b border-collapse-border bg-collapse-surface/50 flex items-center justify-between gap-4">
              <div className="flex gap-1 py-2">
                {([
                  { id: 'formation', label: '⬜ Formation' },
                  { id: 'network',   label: '⬡ Pass Network' },
                  { id: 'compare',   label: '📊 Risk Comparison' },
                ] as const).map(tab => (
                  <button key={tab.id} onClick={() => setRightTab(tab.id)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      rightTab === tab.id ? 'bg-collapse-accent/15 text-collapse-accent border border-collapse-accent/30' : 'text-collapse-muted hover:text-collapse-text'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 py-2 shrink-0">
                <span className="text-[10px] text-emerald-400">● &lt;60% stable</span>
                <span className="text-[10px] text-amber-400">● 60–80% caution</span>
                <span className="text-[10px] text-red-400">● &gt;80% high risk</span>
              </div>
            </div>

            {/* Tab body */}
            {rightTab === 'formation' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <PitchFormation players={xiPlayers} onToggle={togglePlayer}/>
              </div>
            )}
            {rightTab === 'network' && (
              <div className="flex-1 min-h-0">
                <PassNetwork players={xiPlayers} edges={squadData?.edges ?? []}/>
              </div>
            )}
            {rightTab === 'compare' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                <RiskComparison
                  team={team}
                  adjustedRisk={riskData?.adjusted_risk ?? null}
                  tournament={tournament}/>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
