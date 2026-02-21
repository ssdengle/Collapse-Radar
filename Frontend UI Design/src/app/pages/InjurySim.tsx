import { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, UserMinus, ShieldAlert, ArrowRight, Zap, ArrowLeftRight, TrendingUp, UserPlus, X } from 'lucide-react';
import { simulatePlayerRemoval, DEMO_MATCH_ID } from '../../lib/api';
import type { PlayerRemovalResult } from '../../lib/types';

interface Player {
  id: string;
  name: string;
  position: string;
  fatigue: number;
  influence: number;
  minutesPlayed: number;
}

type Pool = 'pitch' | 'subs' | 'reserves';

// 23 players: 11 on pitch, 7 substitutes, 5 reserves
function createSquad(): { pitch: Player[]; subs: Player[]; reserves: Player[] } {
  const all: Player[] = [
    { id: 'p1', name: 'Griezmann', position: 'CAM', fatigue: 88, influence: 92, minutesPlayed: 85 },
    { id: 'p2', name: 'Mbappé', position: 'LW', fatigue: 75, influence: 98, minutesPlayed: 85 },
    { id: 'p3', name: 'Rabiot', position: 'CM', fatigue: 92, influence: 78, minutesPlayed: 85 },
    { id: 'p4', name: 'Varane', position: 'CB', fatigue: 95, influence: 85, minutesPlayed: 85 },
    { id: 'p5', name: 'Tchouaméni', position: 'CDM', fatigue: 82, influence: 75, minutesPlayed: 85 },
    { id: 'p6', name: 'Koundé', position: 'RB', fatigue: 68, influence: 65, minutesPlayed: 85 },
    { id: 'p7', name: 'Hernández', position: 'LB', fatigue: 72, influence: 70, minutesPlayed: 85 },
    { id: 'p8', name: 'Upamecano', position: 'CB', fatigue: 78, influence: 80, minutesPlayed: 85 },
    { id: 'p9', name: 'Dembélé', position: 'RW', fatigue: 65, influence: 88, minutesPlayed: 70 },
    { id: 'p10', name: 'Giroud', position: 'ST', fatigue: 90, influence: 82, minutesPlayed: 85 },
    { id: 'p11', name: 'Lloris', position: 'GK', fatigue: 45, influence: 60, minutesPlayed: 85 },
    { id: 'p12', name: 'Coman', position: 'RW', fatigue: 55, influence: 85, minutesPlayed: 0 },
    { id: 'p13', name: 'Fofana', position: 'CM', fatigue: 50, influence: 72, minutesPlayed: 0 },
    { id: 'p14', name: 'Konaté', position: 'CB', fatigue: 48, influence: 78, minutesPlayed: 0 },
    { id: 'p15', name: 'Camavinga', position: 'CDM', fatigue: 52, influence: 80, minutesPlayed: 0 },
    { id: 'p16', name: 'Thuram', position: 'ST', fatigue: 58, influence: 75, minutesPlayed: 0 },
    { id: 'p17', name: 'Kolo Muani', position: 'ST', fatigue: 50, influence: 82, minutesPlayed: 0 },
    { id: 'p18', name: 'Clauss', position: 'RB', fatigue: 55, influence: 68, minutesPlayed: 0 },
    { id: 'p19', name: 'Maignan', position: 'GK', fatigue: 40, influence: 85, minutesPlayed: 0 },
    { id: 'p20', name: 'Ndombele', position: 'CM', fatigue: 45, influence: 74, minutesPlayed: 0 },
    { id: 'p21', name: 'Saliba', position: 'CB', fatigue: 42, influence: 82, minutesPlayed: 0 },
    { id: 'p22', name: 'Pavard', position: 'RB', fatigue: 48, influence: 70, minutesPlayed: 0 },
    { id: 'p23', name: 'Areola', position: 'GK', fatigue: 35, influence: 65, minutesPlayed: 0 },
  ];
  return {
    pitch: all.slice(0, 11),
    subs: all.slice(11, 18),
    reserves: all.slice(18, 23),
  };
}

const INITIAL_SQUAD = createSquad();

// Left list order: attacker → keeper (for On pitch, Substitutes, Reserves)
const POSITION_ORDER = ['LW', 'ST', 'RW', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'RB', 'GK'];
function sortByPosition(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a.position);
    const ib = POSITION_ORDER.indexOf(b.position);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return (a.position || '').localeCompare(b.position || '');
  });
}

// Fixed 11 slots in formation order (attacker → keeper). Always show 11 nodes; empty = placeholder.
const SLOT_ROLES = ['LW', 'ST', 'RW', 'CM', 'CDM', 'CAM', 'LB', 'CB', 'CB', 'RB', 'GK'] as const;
const ROW_ROLES: string[][] = [
  ['LW', 'ST', 'RW'],
  ['CM', 'CDM', 'CAM'],
  ['LB', 'CB', 'CB', 'RB'],
  ['GK'],
];
function slotId(slotIndex: number): string {
  return `__slot_${slotIndex}`;
}
function slotIndexFromId(id: string): number | null {
  if (id.startsWith('__slot_')) {
    const n = parseInt(id.replace('__slot_', ''), 10);
    if (n >= 0 && n < 11) return n;
  }
  return null;
}

// Assign 11 players to 11 slots by role order (for initial squad).
function assignPlayersToSlots(players: Player[]): (Player | null)[] {
  const byRole: Record<string, Player[]> = {};
  players.forEach((p) => {
    const role = SLOT_ROLES.includes(p.position as any) ? p.position : 'CM';
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(p);
  });
  const roleIndex: Record<string, number> = {};
  const out: (Player | null)[] = [];
  SLOT_ROLES.forEach((role) => {
    const list = byRole[role] ?? [];
    const idx = roleIndex[role] ?? 0;
    out.push(idx < list.length ? list[idx] : null);
    roleIndex[role] = (roleIndex[role] ?? 0) + 1;
  });
  return out;
}

// Fixed layout: 11 positions by slot index. Always returns 11 entries (player id or __slot_N).
function formationLayoutBySlots(width: number, height: number): Map<string, { x: number; y: number }> {
  const pad = 0.08;
  const w = width * (1 - 2 * pad);
  const h = height * (1 - 2 * pad);
  const out = new Map<string, { x: number; y: number }>();
  let slotIdx = 0;
  ROW_ROLES.forEach((rolesInRow, rowIndex) => {
    const totalCols = rolesInRow.length;
    rolesInRow.forEach((_, colIndex) => {
      const col = colIndex + 0.5;
      const x = width * pad + (col / totalCols) * w;
      const y = height * pad + ((rowIndex + 0.5) / ROW_ROLES.length) * h;
      out.set(slotId(slotIdx), { x, y });
      slotIdx++;
    });
  });
  return out;
}

// Grid of slot ids for linking (always 11 slots).
function getFormationSlotIdsBySlots(pitchSlots: (Player | null)[]): (string | null)[][] {
  const grid: (string | null)[][] = [];
  let slotIdx = 0;
  ROW_ROLES.forEach((rolesInRow) => {
    const row: (string | null)[] = [];
    rolesInRow.forEach(() => {
      row.push(slotId(slotIdx));
      slotIdx++;
    });
    grid.push(row);
  });
  return grid;
}

function buildLinksForPitch(_pitchSlots: (Player | null)[]): { source: string; target: string; value: number }[] {
  const grid = getFormationSlotIdsBySlots([]);
  const links: { source: string; target: string; value: number }[] = [];
  const added = new Set<string>();
  const add = (a: string, b: string, v: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!added.has(key) && a !== b) {
      added.add(key);
      links.push({ source: a, target: b, value: v });
    }
  };
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const id = grid[r][c];
      if (!id) continue;
      if (c > 0 && grid[r][c - 1]) add(id, grid[r][c - 1]!, 8);
      if (c < grid[r].length - 1 && grid[r][c + 1]) add(id, grid[r][c + 1]!, 8);
      if (r > 0) {
        const prevRow = grid[r - 1];
        const cc = Math.min(c, prevRow.length - 1);
        if (prevRow[cc]) add(id, prevRow[cc]!, 6);
        if (cc > 0 && prevRow[cc - 1]) add(id, prevRow[cc - 1]!, 5);
        if (cc < prevRow.length - 1 && prevRow[cc + 1]) add(id, prevRow[cc + 1]!, 5);
      }
      if (r < grid.length - 1) {
        const nextRow = grid[r + 1];
        const cc = Math.min(c, nextRow.length - 1);
        if (nextRow[cc]) add(id, nextRow[cc]!, 6);
        if (cc > 0 && nextRow[cc - 1]) add(id, nextRow[cc - 1]!, 5);
        if (cc < nextRow.length - 1 && nextRow[cc + 1]) add(id, nextRow[cc + 1]!, 5);
      }
    }
  }
  return links;
}

// Initial pitch as 11 slots (assigns first 11 by role)
const INITIAL_PITCH_SLOTS = assignPlayersToSlots(INITIAL_SQUAD.pitch);

export function InjurySim() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const substitutesSectionRef = useRef<HTMLDivElement>(null);
  const simulationCleanupRef = useRef<(() => void) | null>(null);
  const [pitch, setPitch] = useState<(Player | null)[]>(() => [...INITIAL_PITCH_SLOTS]);
  const [subs, setSubs] = useState<Player[]>(() => [...INITIAL_SQUAD.subs]);
  const [reserves, setReserves] = useState<Player[]>(() => [...INITIAL_SQUAD.reserves]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [swapSource, setSwapSource] = useState<{ player: Player; pool: Pool } | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [removedForSimulation, setRemovedForSimulation] = useState<string | null>(null);
  const [removalResult, setRemovalResult] = useState<PlayerRemovalResult | null>(null);
  const nodeClickRef = useRef<(d: { id: string; slotIndex?: number; player?: Player | null }) => void>(() => {});

  const removeMutation = useMutation({
    mutationFn: (playerName: string) =>
      simulatePlayerRemoval(DEMO_MATCH_ID, 'Spain', playerName, 75),
    onSuccess: (data) => setRemovalResult(data),
  });
  const pitchRef = useRef<(Player | null)[]>(pitch);
  const subsRef = useRef<Player[]>(subs);
  const reservesRef = useRef<Player[]>(reserves);
  const removedRef = useRef<string | null>(null);
  pitchRef.current = pitch;
  subsRef.current = subs;
  reservesRef.current = reserves;
  removedRef.current = removedForSimulation;

  const pitchPlayers = pitch.filter((p): p is Player => p != null);

  const getPool = useCallback((player: Player): Pool | null => {
    if (pitch.some((p) => p?.id === player.id)) return 'pitch';
    if (subs.some((p) => p.id === player.id)) return 'subs';
    if (reserves.some((p) => p.id === player.id)) return 'reserves';
    return null;
  }, [pitch, subs, reserves]);

  const canSwapWith = useCallback((sourcePool: Pool, targetPlayer: Player): boolean => {
    const targetPool = getPool(targetPlayer);
    if (!targetPool) return false;
    if (sourcePool === 'pitch') return targetPool === 'subs';
    if (sourcePool === 'subs') return targetPool === 'pitch' || targetPool === 'reserves';
    if (sourcePool === 'reserves') return targetPool === 'subs';
    return false;
  }, [getPool]);

  const performSwap = useCallback((from: Pool, to: Pool, playerA: Player, playerB: Player) => {
    if (from === 'pitch' && to === 'subs') {
      setPitch((prev) => prev.map((p) => (p?.id === playerA.id ? playerB : p)));
      setSubs((prev) => prev.map((p) => (p.id === playerB.id ? playerA : p)));
    } else if (from === 'subs' && to === 'pitch') {
      const slotIdx = pitchRef.current.findIndex((p) => p?.id === playerB.id);
      if (slotIdx === -1) return;
      setSubs((prev) => prev.map((p) => (p.id === playerA.id ? playerB : p)));
      setPitch((prev) => prev.map((p, i) => (i === slotIdx ? playerA : p)));
    } else if (from === 'subs' && to === 'reserves') {
      setSubs((prev) => prev.map((p) => (p.id === playerA.id ? playerB : p)));
      setReserves((prev) => prev.map((p) => (p.id === playerB.id ? playerA : p)));
    } else if (from === 'reserves' && to === 'subs') {
      setReserves((prev) => prev.map((p) => (p.id === playerA.id ? playerB : p)));
      setSubs((prev) => prev.map((p) => (p.id === playerB.id ? playerA : p)));
    }
    setSwapSource(null);
  }, []);

  const performAddOrReplaceInSlot = useCallback((slotIndex: number, fromPool: Pool, incoming: Player) => {
    const current = pitchRef.current[slotIndex];
    if (fromPool === 'subs') {
      setSubs((prev) => prev.filter((p) => p.id !== incoming.id));
      if (current) setSubs((prev) => [...prev, current]);
    } else {
      setReserves((prev) => prev.filter((p) => p.id !== incoming.id));
      if (current) setReserves((prev) => [...prev, current]);
    }
    setPitch((prev) => prev.map((p, i) => (i === slotIndex ? incoming : p)));
    setRemovedForSimulation((id) => (id === incoming.id ? null : id));
    setSwapSource(null);
  }, []);

  const performRemoveFromPitch = useCallback((slotIndex: number) => {
    const player = pitchRef.current[slotIndex];
    if (!player) return;
    setPitch((prev) => prev.map((p, i) => (i === slotIndex ? null : p)));
    setSubs((prev) => [...prev, player]);
    setRemovedForSimulation((id) => (id === player.id ? null : id));
    setSelectedPlayer(null);
    setSwapSource(null);
  }, []);

  const drawGraph = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;

    simulationCleanupRef.current?.();
    simulationCleanupRef.current = null;

    let width = el.clientWidth || 600;
    let height = el.clientHeight || 400;
    if (width < 100) width = 600;
    if (height < 100) height = 400;

    el.setAttribute('width', String(width));
    el.setAttribute('height', String(height));

    const svg = d3.select(el);
    svg.selectAll('*').remove();

    const layout = formationLayoutBySlots(width, height);
    const removedId = removedForSimulation;
    // Always 11 nodes: each slot is either player or placeholder (skeletal)
    const nodes: Array<{ id: string; slotIndex: number; role: string; player: Player | null; name: string; position: string; influence: number; x: number; y: number }> = [];
    for (let i = 0; i < 11; i++) {
      const pos = layout.get(slotId(i)) ?? { x: width / 2, y: height / 2 };
      const player = pitch[i];
      const isRemoved = player?.id === removedId;
      const effectivePlayer = isRemoved ? null : player;
      nodes.push({
        id: effectivePlayer ? effectivePlayer.id : slotId(i),
        slotIndex: i,
        role: SLOT_ROLES[i],
        player: effectivePlayer,
        name: effectivePlayer?.name ?? '',
        position: effectivePlayer?.position ?? SLOT_ROLES[i],
        influence: effectivePlayer?.influence ?? 28,
        x: pos.x,
        y: pos.y,
      });
    }

    const rawLinks = buildLinksForPitch(pitch);
    const linkData = rawLinks.map((l) => {
      const source = nodes.find((n) => n.id === l.source)!;
      const target = nodes.find((n) => n.id === l.target)!;
      const isPlaceholderLink = !source?.player || !target?.player;
      return { ...l, source, target, isRemovedLink: isPlaceholderLink };
    }).filter((l) => l.source && l.target);

    const zoomG = svg.append('g');

    const link = zoomG.append('g')
      .selectAll('line')
      .data(linkData)
      .join('line')
      .attr('stroke', (d: any) => (d.isRemovedLink ? '#1e293b' : '#334155'))
      .attr('stroke-opacity', (d: any) => (d.isRemovedLink ? 0.9 : 0.6))
      .attr('stroke-width', (d: any) => (d.isRemovedLink ? 2 : Math.sqrt(d.value)))
      .attr('stroke-dasharray', (d: any) => (d.isRemovedLink ? '4 3' : 'none'))
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    const node = zoomG.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    const positionColor = (position: string) => {
      if (!position) return '#0f172a';
      if (['LW', 'ST', 'RW'].includes(position)) return '#EF4444';
      if (['CM', 'CDM', 'CAM'].includes(position)) return '#10B981';
      if (['LB', 'CB', 'RB'].includes(position)) return '#3B82F6';
      if (position === 'GK') return '#EAB308';
      return '#94a3b8';
    };
    const isPlaceholder = (d: any) => d.id.startsWith('__slot_');
    const circles = node.append('circle')
      .attr('r', (d) => (isPlaceholder(d) ? 18 : d.influence / 3))
      .attr('fill', (d) => (isPlaceholder(d) ? '#0f172a' : positionColor(d.position)))
      .attr('stroke', (d) => (isPlaceholder(d) ? '#334155' : '#fff'))
      .attr('stroke-width', (d) => (isPlaceholder(d) ? 1 : 2))
      .attr('stroke-dasharray', (d) => (isPlaceholder(d) ? '3 3' : 'none'))
      .style('cursor', (d) => (isPlaceholder(d) ? 'copy' : 'pointer'))
      .style('pointer-events', 'all')
      .on('click', (event, d: any) => {
        event.stopPropagation();
        nodeClickRef.current?.(d);
      });

    circles.each(function (this: SVGCircleElement, d: any) {
      const el = this;
      el.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      el.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const raw = e.dataTransfer?.getData('application/json');
        if (!raw) return;
        try {
          const { id: draggedId, pool } = JSON.parse(raw);
          if (pool === 'subs' || pool === 'reserves') dropHandlerRef.current(draggedId, pool, d.id);
        } catch (_) {}
      });
    });

    node.append('text')
      .text((d) => (isPlaceholder(d) ? '—' : d.name))
      .attr('x', 0)
      .attr('y', (d) => -(isPlaceholder(d) ? 18 : d.influence / 3) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => (isPlaceholder(d) ? '#64748b' : '#E2E8F0'))
      .attr('font-size', (d) => (isPlaceholder(d) ? '10px' : '12px'))
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => zoomG.attr('transform', event.transform));
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width * 0.1, height * 0.1).scale(0.85));

    simulationCleanupRef.current = () => {};
  }, [pitch, removedForSimulation]);

  // Initial draw after layout (fixes empty graph when container sizes late)
  useEffect(() => {
    const t = setTimeout(() => drawGraph(), 150);
    return () => {
      clearTimeout(t);
      simulationCleanupRef.current?.();
    };
  }, [drawGraph]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (svgRef.current && svgRef.current.clientWidth > 0 && svgRef.current.clientHeight > 0) {
        drawGraph();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawGraph]);

  const optimization = useCallback(() => {
    const players = pitch.filter((p): p is Player => p != null);
    if (players.length === 0) {
      return { score: 0, recommendations: ['Add players to pitch (drag from Subs/Reserves or use Add to pitch) to see optimization.'] };
    }
    const avgFatigue = players.reduce((s, p) => s + p.fatigue, 0) / players.length;
    const avgInfluence = players.reduce((s, p) => s + p.influence, 0) / players.length;
    const freshScore = Math.max(0, 100 - avgFatigue);
    const score = Math.round((freshScore * 0.5 + avgInfluence * 0.5));
    const highFatigue = players.filter((p) => p.fatigue >= 85).sort((a, b) => b.fatigue - a.fatigue);
    const recommendations: string[] = [];
    if (players.length < 11) {
      recommendations.push(`${11 - players.length} empty slot(s). Drag a sub/reserve onto a placeholder to fill.`);
    }
    if (highFatigue.length > 0) {
      recommendations.push(`Rest high fatigue: ${highFatigue.slice(0, 3).map((p) => p.name).join(', ')}. Add fresh legs from subs.`);
    }
    if (avgFatigue > 75) {
      recommendations.push('Consider 2–3 substitutions to lower average fatigue and reduce collapse risk.');
    }
    if (score >= 75 && players.length === 11) {
      recommendations.push('Lineup is well balanced for influence and load.');
    }
    return { score: Math.min(100, score), recommendations: recommendations.length ? recommendations : ['Current XI looks good.'] };
  }, [pitch]);
  const opt = optimization();

  const handlePlayerClick = (player: Player, canBeSwapTarget: boolean) => {
    if (swapSource) {
      if (canBeSwapTarget && swapSource.player.id !== player.id) {
        const targetPool = getPool(player)!;
        performSwap(swapSource.pool, targetPool, swapSource.player, player);
      }
      return;
    }
    setSelectedPlayer(player);
    setSimulationRunning(false);
  };

  const startSwap = (e: React.MouseEvent, player: Player, pool: Pool) => {
    e.stopPropagation();
    setSwapSource((prev) => (prev?.player.id === player.id ? null : { player, pool }));
  };

  const startAddToPitch = (e: React.MouseEvent, player: Player, pool: Pool) => {
    e.stopPropagation();
    if (pool === 'subs' || pool === 'reserves') {
      setSwapSource({ player, pool });
    }
  };

  const swapTargetPools: Pool[] = swapSource
    ? swapSource.pool === 'pitch'
      ? ['subs']
      : swapSource.pool === 'subs'
        ? ['pitch', 'reserves']
        : ['subs']
    : [];

  const isSwapTarget = (player: Player, pool: Pool) =>
    swapSource !== null && swapSource.player.id !== player.id && swapTargetPools.includes(pool);

  nodeClickRef.current = (d: { id: string; slotIndex?: number; player?: Player | null }) => {
    if (d.id.startsWith('__slot_') && d.slotIndex != null) {
      if (swapSource && (swapSource.pool === 'subs' || swapSource.pool === 'reserves')) {
        performAddOrReplaceInSlot(d.slotIndex, swapSource.pool, swapSource.player);
      }
      return;
    }
    const player = d.player ?? pitchRef.current.flat().find((p) => p?.id === d.id);
    if (player) {
      const pool = getPool(player) ?? 'pitch';
      handlePlayerClick(player, isSwapTarget(player, pool));
    }
  };

  const handleDropOnFormation = useCallback((draggedId: string, fromPool: Pool, targetId: string) => {
    if (fromPool !== 'subs' && fromPool !== 'reserves') return;
    const fromList = fromPool === 'subs' ? subsRef.current : reservesRef.current;
    const dragged = fromList.find((p) => p.id === draggedId);
    if (!dragged) return;
    const slotIdx = slotIndexFromId(targetId);
    if (slotIdx !== null) {
      performAddOrReplaceInSlot(slotIdx, fromPool, dragged);
      return;
    }
    const slotIndex = pitchRef.current.findIndex((p) => p?.id === targetId);
    if (slotIndex >= 0) performAddOrReplaceInSlot(slotIndex, fromPool, dragged);
  }, [performAddOrReplaceInSlot]);

  const dropHandlerRef = useRef(handleDropOnFormation);
  dropHandlerRef.current = handleDropOnFormation;

  function PlayerCard({
    player,
    pool,
    label,
    slotIndex,
    slotRole,
    onRemove,
  }: {
    player: Player;
    pool: Pool;
    label?: string;
    slotIndex?: number;
    slotRole?: string;
    onRemove?: () => void;
  }) {
    const isTarget = isSwapTarget(player, pool);
    const canDrag = pool === 'subs' || pool === 'reserves';
    return (
      <div
        className={`p-3 rounded-lg border transition-all cursor-pointer ${
          selectedPlayer?.id === player.id ? 'bg-collapse-accent/10 border-collapse-accent' : 'bg-collapse-bg border-collapse-border hover:border-collapse-muted'
        } ${isTarget ? 'ring-2 ring-collapse-accent border-collapse-accent' : ''} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onClick={() => handlePlayerClick(player, isTarget)}
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) return;
          e.dataTransfer.setData('application/json', JSON.stringify({ id: player.id, pool }));
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-sm">{player.name}</span>
          <div className="flex items-center gap-1">
            {label && <span className="text-[10px] text-collapse-muted uppercase">{label}</span>}
            {slotRole && <span className="text-[10px] text-collapse-muted">({slotRole})</span>}
            <span className="text-xs font-mono bg-collapse-surface px-1.5 py-0.5 rounded border border-collapse-border">{player.position}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-collapse-muted">
            <span>Fatigue</span>
            <span className={`${player.fatigue > 85 ? 'text-collapse-risk' : player.fatigue > 70 ? 'text-collapse-warn' : 'text-collapse-safe'}`}>{player.fatigue}%</span>
          </div>
          <div className="h-1.5 bg-collapse-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${player.fatigue > 85 ? 'bg-collapse-risk' : player.fatigue > 70 ? 'bg-collapse-warn' : 'bg-collapse-safe'}`}
              style={{ width: `${player.fatigue}%` }}
            />
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {pool === 'pitch' && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="py-1.5 px-2 rounded text-xs font-medium flex items-center gap-1 bg-collapse-risk/20 text-collapse-risk border border-collapse-risk/30 hover:bg-collapse-risk/30 transition-colors"
              title="Remove from pitch (moves to substitutes)"
            >
              <UserMinus className="w-3 h-3" />
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isTarget) {
                handlePlayerClick(player, true);
              } else if (swapSource?.player.id === player.id) {
                setSwapSource(null);
              } else {
                startSwap(e, player, pool);
              }
            }}
            className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
              swapSource?.player.id === player.id
                ? 'bg-collapse-accent text-white'
                : 'bg-collapse-surface border border-collapse-border hover:border-collapse-accent text-collapse-muted hover:text-collapse-accent'
            }`}
          >
            <ArrowLeftRight className="w-3 h-3" />
            {swapSource?.player.id === player.id ? 'Cancel' : isTarget ? 'Replace here' : 'Swap'}
          </button>
          {(pool === 'subs' || pool === 'reserves') && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isTarget) handlePlayerClick(player, true);
                else startAddToPitch(e, player, pool);
              }}
              className="flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 bg-collapse-accent/20 text-collapse-accent border border-collapse-accent/30 hover:bg-collapse-accent/30 transition-colors"
              title="Add to pitch – then click a slot (or placeholder) or drag onto formation"
            >
              <UserPlus className="w-3 h-3" />
              Add to pitch
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-collapse-bg text-collapse-text overflow-hidden flex">
      {/* Left Sidebar: On Pitch, Substitutes, Reserves */}
      <div className="w-80 border-r border-collapse-border p-6 flex flex-col gap-4 bg-collapse-surface z-10 shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold font-sans mb-1">Squad Status</h2>
            <p className="text-sm text-collapse-muted">On pitch, substitutes & reserves. Swap, add to pitch, or remove. Empty slots show placeholders.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPitch([...INITIAL_PITCH_SLOTS]);
              setSubs([...INITIAL_SQUAD.subs]);
              setReserves([...INITIAL_SQUAD.reserves]);
              setSelectedPlayer(null);
              setSwapSource(null);
              setRemovedForSimulation(null);
              setSimulationRunning(false);
            }}
            className="shrink-0 py-1.5 px-3 rounded-lg text-xs font-medium bg-collapse-surface border border-collapse-border hover:border-collapse-accent text-collapse-muted hover:text-collapse-accent transition-colors"
          >
            Reset squad
          </button>
        </div>

        {swapSource && (
          <div className="p-2 rounded-lg bg-collapse-accent/10 border border-collapse-accent text-xs text-collapse-text">
            {swapSource.pool === 'pitch' ? (
              <>Swapping <strong>{swapSource.player.name}</strong>. Click a player in Substitutes to complete.</>
            ) : (
              <>Adding <strong>{swapSource.player.name}</strong> to pitch. Click a slot on the formation to replace, or drag this card onto a formation slot.</>
            )}
          </div>
        )}

        {/* Team optimization – recalculates when lineup changes (swap or drag onto formation) */}
        <div key={pitch.map((p) => p?.id ?? '_').join(',')} className="p-4 rounded-xl bg-collapse-bg border border-collapse-border">
          <h3 className="text-xs font-semibold text-collapse-muted uppercase tracking-wider mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-collapse-accent" />
            Team optimization
          </h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl font-bold font-mono ${opt.score >= 70 ? 'text-collapse-safe' : opt.score >= 50 ? 'text-collapse-warn' : 'text-collapse-risk'}`}>
              {opt.score}%
            </span>
            <span className="text-xs text-collapse-muted">based on current XI</span>
          </div>
          <p className="text-[10px] text-collapse-muted mb-2">Updates when you swap or drag a player onto the formation.</p>
          <ul className="space-y-1.5 text-xs text-collapse-text">
            {opt.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-collapse-accent mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-collapse-muted uppercase tracking-wider mb-2">On pitch ({pitchPlayers.length}/11) — skeletal slots always shown</h3>
            <div className="space-y-2">
              {pitch.map((player, slotIndex) =>
                player ? (
                  <PlayerCard
                    key={`${slotIndex}-${player.id}`}
                    player={player}
                    pool="pitch"
                    slotIndex={slotIndex}
                    slotRole={SLOT_ROLES[slotIndex]}
                    onRemove={() => performRemoveFromPitch(slotIndex)}
                  />
                ) : (
                  <div
                    key={`empty-${slotIndex}`}
                    className="p-3 rounded-lg border border-dashed border-collapse-border bg-collapse-bg/50 text-collapse-muted text-xs flex items-center justify-between"
                  >
                    <span>Empty — {SLOT_ROLES[slotIndex]}</span>
                    <span className="text-[10px]">Drop or Add to pitch to fill</span>
                  </div>
                )
              )}
            </div>
          </div>
          <div ref={substitutesSectionRef}>
            <h3 className="text-xs font-semibold text-collapse-muted uppercase tracking-wider mb-2">Substitutes ({subs.length}) — use &quot;Add to pitch&quot; below</h3>
            <div className="space-y-2">
              {sortByPosition(subs).map((player) => (
                <PlayerCard key={player.id} player={player} pool="subs" />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-collapse-muted uppercase tracking-wider mb-2">Reserves ({reserves.length}) — use &quot;Add to pitch&quot; below</h3>
            <div className="space-y-2">
              {sortByPosition(reserves).map((player) => (
                <PlayerCard key={player.id} player={player} pool="reserves" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Center: D3 Graph Area - min height so SVG has dimensions for D3 */}
      <div ref={containerRef} className="flex-1 relative bg-collapse-bg min-h-[400px] flex flex-col">
        {/* Visible "Add player" strip so users see it from the graph view */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 p-3 bg-collapse-surface/90 border-b border-collapse-border">
          <span className="text-sm text-collapse-muted">
            To add a player to the pitch: scroll the <strong className="text-collapse-text">left panel</strong> to <strong className="text-collapse-text">Substitutes</strong> or <strong className="text-collapse-text">Reserves</strong>, click <strong className="text-collapse-accent">Add to pitch</strong>, then click a player on pitch to replace.
          </span>
          <button
            type="button"
            onClick={() => substitutesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 px-4 py-2 rounded-lg bg-collapse-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-collapse-accent/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add player to pitch
          </button>
        </div>
        <div className="relative flex-1 min-h-[320px]">
          <div className="absolute top-2 left-2 z-10 bg-collapse-surface/80 backdrop-blur p-2 rounded border border-collapse-border text-xs text-collapse-muted pointer-events-none" title="Nodes = players (size = influence). Red = attackers, green = midfield, blue = defenders, yellow = keeper. Draggable.">
            Node size = Influence • <span className="text-[#EF4444]">Attackers</span> <span className="text-[#10B981]">Mid</span> <span className="text-[#3B82F6]">Def</span> <span className="text-[#EAB308]">GK</span> • Drag to pan, scroll to zoom
          </div>
          <svg ref={svgRef} className="w-full h-full min-h-[300px] cursor-grab active:cursor-grabbing" style={{ display: 'block' }} />
        </div>
      </div>

      {/* Right Sidebar: Impact Analysis (Conditional) */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div 
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-96 border-l border-collapse-border bg-collapse-surface p-6 flex flex-col gap-6 shadow-2xl z-20 absolute right-0 top-0 bottom-0"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 mb-2 min-w-0">
                <div className="w-12 h-12 rounded-full bg-collapse-bg flex items-center justify-center border border-collapse-border text-xl font-bold">
                  {selectedPlayer.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold truncate">{selectedPlayer.name}</h3>
                  <span className="text-sm text-collapse-muted">{selectedPlayer.position} • {selectedPlayer.minutesPlayed} mins</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedPlayer(null); setSwapSource(null); setRemovedForSimulation(null); setSimulationRunning(false); setRemovalResult(null); }}
                className="p-2 rounded-lg text-collapse-muted hover:text-collapse-text hover:bg-collapse-bg border border-transparent hover:border-collapse-border shrink-0"
                aria-label="Close panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-0">
                <div className="bg-collapse-bg p-3 rounded border border-collapse-border text-center" title="Share of passes completed by this player in the match (or window).">
                  <div className="text-xs text-collapse-muted uppercase mb-1">Pass Completion</div>
                  <div className="font-mono font-bold text-lg">87%</div>
                </div>
                <div className="bg-collapse-bg p-3 rounded border border-collapse-border text-center" title="Passes that lead directly to a shot or big chance.">
                  <div className="text-xs text-collapse-muted uppercase mb-1">Key Passes</div>
                  <div className="font-mono font-bold text-lg">4</div>
                </div>
            </div>

            <div className="border-t border-collapse-border pt-4">
               <h4 className="font-bold mb-4 flex items-center gap-2">
                 <Zap className="w-4 h-4 text-collapse-warn" />
                 Injury Simulation
               </h4>
               
               <p className="text-sm text-collapse-muted mb-6">
                 Simulate the immediate impact on team structure if {selectedPlayer.name} is removed from play.
               </p>

               {!simulationRunning ? (
                 <button
                   onClick={() => {
                     if (selectedPlayer) {
                       setSimulationRunning(true);
                       setRemovedForSimulation(selectedPlayer.id);
                       setRemovalResult(null);
                       removeMutation.mutate(selectedPlayer.name);
                     }
                   }}
                   disabled={removeMutation.isPending}
                   className="w-full py-3 bg-collapse-risk text-white font-bold rounded-lg shadow-lg shadow-collapse-risk/20 hover:bg-collapse-risk/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   <UserMinus className="w-5 h-5" />
                   {removeMutation.isPending ? 'Simulating…' : 'Remove Player'}
                 </button>
               ) : (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="space-y-6"
                 >
                   <div className="bg-collapse-bg border border-collapse-border rounded-lg p-4" title="Current = risk with full XI. Projected = risk after removing this player. Shows how critical they are.">
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-medium">Collapse Probability</span>
                       <span className="text-xs text-collapse-muted">Before vs After</span>
                     </div>
                     {removalResult ? (
                       <>
                         <div className="flex items-center justify-between mb-2">
                           <div className="text-center">
                             <span className="block text-2xl font-bold text-collapse-text">{Math.round(removalResult.original_probability * 100)}%</span>
                             <span className="text-xs text-collapse-muted">Current</span>
                           </div>
                           <ArrowRight className="w-5 h-5 text-collapse-muted" />
                           <div className="text-center">
                             <motion.span
                               initial={{ opacity: 0, y: 5 }}
                               animate={{ opacity: 1, y: 0 }}
                               className="block text-3xl font-bold text-collapse-risk"
                             >
                               {Math.round(removalResult.new_probability * 100)}%
                             </motion.span>
                             <span className="text-xs text-collapse-risk font-bold">Projected</span>
                           </div>
                         </div>
                         <div className="relative h-2 bg-collapse-surface rounded-full overflow-hidden mt-2">
                           <div className="absolute top-0 bottom-0 left-0 bg-collapse-safe z-10" style={{ width: `${removalResult.original_probability * 100}%` }} />
                           <motion.div
                             className="absolute top-0 bottom-0 left-0 bg-collapse-risk/50 z-0"
                             initial={{ width: 0 }}
                             animate={{ width: `${removalResult.new_probability * 100}%` }}
                             transition={{ duration: 1, delay: 0.2 }}
                           />
                         </div>
                         <p className="text-xs text-collapse-muted mt-2">Delta: {removalResult.delta >= 0 ? '+' : ''}{(removalResult.delta * 100).toFixed(1)}%</p>
                       </>
                     ) : (
                       <div className="flex items-center justify-between mb-2">
                         <div className="text-center">
                           <span className="block text-2xl font-bold text-collapse-text">12%</span>
                           <span className="text-xs text-collapse-muted">Current</span>
                         </div>
                         <ArrowRight className="w-5 h-5 text-collapse-muted" />
                         <div className="text-center">
                           <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="block text-3xl font-bold text-collapse-risk">
                             {12 + Math.round(selectedPlayer.influence / 4)}%
                           </motion.span>
                           <span className="text-xs text-collapse-risk font-bold">Projected</span>
                         </div>
                       </div>
                     )}
                   </div>

                   <div className="space-y-3">
                      <div className="flex items-start gap-3 text-sm">
                        <ShieldAlert className="w-5 h-5 text-collapse-risk shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-collapse-risk block">Structural Integrity Critical</span>
                          <span className="text-collapse-muted">Loss of {selectedPlayer.name} creates significant gaps in sector 4.</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <Activity className="w-5 h-5 text-collapse-warn shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-collapse-warn block">Momentum Shift</span>
                          <span className="text-collapse-muted">Expected possession drops by 14%.</span>
                        </div>
                      </div>
                   </div>

                   <button
                     onClick={() => { setSimulationRunning(false); setRemovedForSimulation(null); setRemovalResult(null); }}
                     className="w-full py-2 bg-collapse-surface border border-collapse-border text-collapse-text font-medium rounded-lg hover:bg-collapse-border transition-colors text-sm"
                   >
                     Reset simulation (restore formation)
                   </button>
                 </motion.div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
