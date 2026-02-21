import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, UserMinus, ShieldAlert, ArrowRight, Zap } from 'lucide-react';
import { getPassNetwork, simulatePlayerRemoval } from '../../lib/api';
import type { PlayerRemovalResult } from '../../lib/types';
import { useMatch } from '../context/MatchContext';
import { Skeleton } from '../components/ui/skeleton';

interface Player {
  id: string;
  name: string;
  position: string;
  fatigue: number;
  influence: number;
  minutesPlayed: number;
}

const DEMO_MINUTE = 75;

export function InjurySim() {
  const { matchId, team } = useMatch();
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [removalResult, setRemovalResult] = useState<PlayerRemovalResult | null>(null);

  const { data: network, isLoading: networkLoading } = useQuery({
    queryKey: ['network', matchId, DEMO_MINUTE, team],
    queryFn: () => getPassNetwork(matchId, DEMO_MINUTE, team),
    enabled: !!matchId && !!team,
  });

  const removeMutation = useMutation({
    mutationFn: (player: string) =>
      simulatePlayerRemoval(matchId, team, player, DEMO_MINUTE),
    onSuccess: (data) => setRemovalResult(data),
  });

  const players: Player[] = useMemo(
    () =>
      (network?.nodes ?? []).map((node) => ({
        id: node.player.replace(/\s+/g, '_'),
        name: node.player,
        position: '',
        fatigue: Math.round(node.fatigue_score * 100),
        influence: Math.round(node.influence_score * 100),
        minutesPlayed: node.minutes_played,
      })),
    [network]
  );

  const links = useMemo(
    () =>
      (network?.edges ?? []).map((e) => ({
        source: e.from_player.replace(/\s+/g, '_'),
        target: e.to_player.replace(/\s+/g, '_'),
        value: e.pass_count,
      })),
    [network]
  );

  useEffect(() => {
    if (!svgRef.current || players.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes = players.map((p) => ({ ...p, x: width / 2, y: height / 2 }));

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum & Player & { x?: number; y?: number }[])
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.influence / 2));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.sqrt(d.value));

    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Player circles (sized by influence, colored by fatigue)
    node.append('circle')
      .attr('r', (d) => d.influence / 3)
      .attr('fill', (d) => {
        // Color scale from Green (low fatigue) to Red (high fatigue)
        const color = d3.scaleLinear<string>()
          .domain([0, 50, 100])
          .range(['#10B981', '#F59E0B', '#EF4444']);
        return color(d.fatigue);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        const p = d as unknown as Player;
        setSelectedPlayer(p);
        setRemovalResult(null);
        removeMutation.mutate(p.name);
      });

    // Player Labels
    node.append('text')
      .text((d) => d.name)
      .attr('x', 0)
      .attr('y', (d) => - (d.influence / 3) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#E2E8F0')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [players, links]);

  return (
    <div className="h-full bg-collapse-bg text-collapse-text overflow-hidden flex">
      {/* Left Sidebar: Fatigue & List */}
      <div className="w-80 border-r border-collapse-border p-6 flex flex-col gap-6 bg-collapse-surface z-10 shadow-xl">
        <div>
          <h2 className="text-xl font-bold font-sans mb-1">Squad Status</h2>
          <p className="text-sm text-collapse-muted">Real-time biometrics & load</p>
        </div>

        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
          {players.map((player) => (
            <div
              key={player.id}
              onClick={() => {
                setSelectedPlayer(player);
                setRemovalResult(null);
                removeMutation.mutate(player.name);
              }}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${selectedPlayer?.id === player.id ? 'bg-collapse-accent/10 border-collapse-accent' : 'bg-collapse-bg border-collapse-border hover:border-collapse-muted'}`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm">{player.name}</span>
                <span className="text-xs font-mono bg-collapse-surface px-1.5 py-0.5 rounded border border-collapse-border">{player.position}</span>
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
            </div>
          ))}
        </div>
      </div>

      {/* Center: D3 Graph Area */}
      <div className="flex-1 relative bg-collapse-bg">
        <div className="absolute top-4 left-4 z-10 bg-collapse-surface/80 backdrop-blur p-2 rounded border border-collapse-border text-xs text-collapse-muted pointer-events-none">
          Force-Directed Pass Network • Node Size = Influence • Color = Fatigue
        </div>
        {networkLoading || players.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center p-8">
            <div className="space-y-3 w-full max-w-md">
              <Skeleton className="h-4 w-full bg-collapse-surface" />
              <Skeleton className="h-64 w-full bg-collapse-surface" />
            </div>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        )}
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
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-collapse-bg flex items-center justify-center border border-collapse-border text-xl font-bold">
                  {selectedPlayer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedPlayer.name}</h3>
                  <span className="text-sm text-collapse-muted">{selectedPlayer.position} • {selectedPlayer.minutesPlayed} mins</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-collapse-bg p-3 rounded border border-collapse-border text-center">
                  <div className="text-xs text-collapse-muted uppercase mb-1">Pass Completion</div>
                  <div className="font-mono font-bold text-lg">87%</div>
                </div>
                <div className="bg-collapse-bg p-3 rounded border border-collapse-border text-center">
                  <div className="text-xs text-collapse-muted uppercase mb-1">Key Passes</div>
                  <div className="font-mono font-bold text-lg">4</div>
                </div>
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

               {!removalResult && !removeMutation.isPending ? (
                 <p className="text-sm text-collapse-muted">Click a player above or in the graph to run the simulation.</p>
               ) : removalResult ? (
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="space-y-6"
                 >
                   <div className="bg-collapse-bg border border-collapse-border rounded-lg p-4">
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-medium">Collapse Probability</span>
                       <span className="text-xs text-collapse-muted">Before vs After</span>
                     </div>
                     <div className="flex items-center justify-between mb-2">
                       <div className="text-center">
                         <span className="block text-2xl font-bold text-collapse-text">
                           {(removalResult.original_probability * 100).toFixed(1)}%
                         </span>
                         <span className="text-xs text-collapse-muted">Current</span>
                       </div>
                       <ArrowRight className="w-5 h-5 text-collapse-muted" />
                       <div className="text-center">
                         <motion.span
                           initial={{ opacity: 0, y: 5 }}
                           animate={{ opacity: 1, y: 0 }}
                           className={`block text-3xl font-bold ${removalResult.delta > 0 ? 'text-collapse-risk' : 'text-collapse-safe'}`}
                         >
                           {(removalResult.new_probability * 100).toFixed(1)}%
                         </motion.span>
                         <span className="text-xs font-bold">
                           {removalResult.delta > 0 ? '+' : ''}{(removalResult.delta * 100).toFixed(1)}%
                         </span>
                       </div>
                     </div>
                     <div className="relative h-2 bg-collapse-surface rounded-full overflow-hidden mt-2">
                       <div
                         className="absolute top-0 bottom-0 left-0 bg-collapse-safe z-10"
                         style={{ width: `${removalResult.original_probability * 100}%` }}
                       />
                       <motion.div
                         className="absolute top-0 bottom-0 left-0 bg-collapse-risk/50 z-0"
                         initial={{ width: `${removalResult.original_probability * 100}%` }}
                         animate={{ width: `${removalResult.new_probability * 100}%` }}
                         transition={{ duration: 1, delay: 0.2 }}
                       />
                     </div>
                   </div>
                   <div className="space-y-3">
                     <div className="flex items-start gap-3 text-sm">
                       <ShieldAlert className="w-5 h-5 text-collapse-risk shrink-0 mt-0.5" />
                       <div>
                         <span className="font-bold text-collapse-risk block">Structural Impact</span>
                         <span className="text-collapse-muted">
                           Loss of {removalResult.removed_player} changes collapse probability by {removalResult.delta > 0 ? '+' : ''}{(removalResult.delta * 100).toFixed(1)}%.
                         </span>
                       </div>
                     </div>
                   </div>
                   <button
                     onClick={() => setRemovalResult(null)}
                     className="w-full py-2 bg-collapse-surface border border-collapse-border text-collapse-text font-medium rounded-lg hover:bg-collapse-border transition-colors text-sm"
                   >
                     Reset Simulation
                   </button>
                 </motion.div>
               ) : (
                 <div className="text-sm text-collapse-muted">Running simulation…</div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
