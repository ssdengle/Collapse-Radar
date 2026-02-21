import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Thermometer, UserMinus, ShieldAlert, ArrowRight, Zap } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  position: string;
  fatigue: number; // 0-100
  influence: number; // 0-100
  minutesPlayed: number;
}

const players: Player[] = [
  { id: 'p1', name: 'Griezmann', position: 'CAM', fatigue: 88, influence: 92, minutesPlayed: 85 },
  { id: 'p2', name: 'Mbappé', position: 'LW', fatigue: 75, influence: 98, minutesPlayed: 85 },
  { id: 'p3', name: 'Rabiot', position: 'CM', fatigue: 92, influence: 78, minutesPlayed: 85 },
  { id: 'p4', name: 'Varane', position: 'CB', fatigue: 95, influence: 85, minutesPlayed: 85 },
  { id: 'p5', name: 'Tchouaméni', position: 'CDM', fatigue: 82, influence: 75, minutesPlayed: 85 },
  { id: 'p6', name: 'Koundé', position: 'RB', fatigue: 68, influence: 65, minutesPlayed: 85 },
];

export function InjurySim() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Mock graph data based on players
    const nodes = players.map(p => ({ ...p, x: width / 2, y: height / 2 }));
    const links = [
      { source: 'p1', target: 'p2', value: 15 },
      { source: 'p1', target: 'p3', value: 12 },
      { source: 'p3', target: 'p4', value: 8 },
      { source: 'p3', target: 'p5', value: 10 },
      { source: 'p4', target: 'p5', value: 5 },
      { source: 'p5', target: 'p6', value: 7 },
      { source: 'p2', target: 'p1', value: 10 },
      { source: 'p6', target: 'p1', value: 4 },
    ];

    const simulation = d3.forceSimulation(nodes as any)
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
        setSelectedPlayer(d as any);
        setSimulationRunning(false); // Reset simulation state on new selection
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
  }, []);

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
              onClick={() => { setSelectedPlayer(player); setSimulationRunning(false); }}
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
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
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

               {!simulationRunning ? (
                 <button 
                   onClick={() => setSimulationRunning(true)}
                   className="w-full py-3 bg-collapse-risk text-white font-bold rounded-lg shadow-lg shadow-collapse-risk/20 hover:bg-collapse-risk/90 transition-all flex items-center justify-center gap-2"
                 >
                   <UserMinus className="w-5 h-5" />
                   Remove Player
                 </button>
               ) : (
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
                         <span className="block text-2xl font-bold text-collapse-text">12%</span>
                         <span className="text-xs text-collapse-muted">Current</span>
                       </div>
                       <ArrowRight className="w-5 h-5 text-collapse-muted" />
                       <div className="text-center">
                         <motion.span 
                           initial={{ opacity: 0, y: 5 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="block text-3xl font-bold text-collapse-risk"
                         >
                           {12 + Math.round(selectedPlayer.influence / 4)}%
                         </motion.span>
                         <span className="text-xs text-collapse-risk font-bold">Projected</span>
                       </div>
                     </div>
                     
                     {/* Gauge Bar */}
                     <div className="relative h-2 bg-collapse-surface rounded-full overflow-hidden mt-2">
                        <div className="absolute top-0 bottom-0 left-0 w-[12%] bg-collapse-safe z-10" />
                        <motion.div 
                          className="absolute top-0 bottom-0 left-0 bg-collapse-risk/50 z-0"
                          initial={{ width: "12%" }}
                          animate={{ width: `${12 + Math.round(selectedPlayer.influence / 4)}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                        />
                     </div>
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
                     onClick={() => setSimulationRunning(false)}
                     className="w-full py-2 bg-collapse-surface border border-collapse-border text-collapse-text font-medium rounded-lg hover:bg-collapse-border transition-colors text-sm"
                   >
                     Reset Simulation
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
