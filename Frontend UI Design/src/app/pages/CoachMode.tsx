import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, TrendingDown, Users, Activity, PlayCircle, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function CoachMode() {
  const [revealed, setRevealed] = useState(false);
  const goalMinute = 67;

  // Mock data for the counterfactual chart
  const data = Array.from({ length: 80 }, (_, i) => {
    let actual = 0.2 + (i / 100);
    if (i > 50) actual += (i - 50) * 0.02; // Risk spiking
    
    // Projected "What If" scenario: intervention at min 55
    let projected = actual;
    if (i > 55) {
      projected = Math.max(0.1, actual - ((i - 55) * 0.03));
    }

    return {
      minute: i,
      actual: Math.min(0.95, actual),
      projected: Math.min(0.95, projected)
    };
  });

  const greenPathVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: 1.5, ease: "easeInOut" }
    }
  };

  return (
    <div className="h-full p-6 bg-collapse-bg text-collapse-text overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Left Column: Risk Summary */}
      <div className="col-span-1 space-y-6">
        <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-collapse-muted text-sm font-medium uppercase tracking-wider">Current Risk Level</h3>
            <span className="px-2 py-1 bg-collapse-risk/10 text-collapse-risk rounded text-xs font-bold border border-collapse-risk/20">HIGH</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-bold font-sans tracking-tight">72%</span>
            <span className="text-collapse-risk flex items-center text-sm font-medium bg-collapse-risk/10 px-2 py-1 rounded">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              +14%
            </span>
          </div>
          <p className="text-sm text-collapse-muted">Probability of conceding within 10 mins.</p>
        </div>

        <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
           <h3 className="text-collapse-muted text-sm font-medium uppercase tracking-wider mb-4">Lead Time Estimate</h3>
           <div className="flex items-center gap-4">
             <div className="p-3 bg-collapse-warn/10 text-collapse-warn rounded-lg border border-collapse-warn/20">
               <Activity className="w-6 h-6" />
             </div>
             <div>
               <span className="text-2xl font-bold block">8.5 mins</span>
               <span className="text-xs text-collapse-muted">Until critical threshold breach</span>
             </div>
           </div>
        </div>

        {/* Tactical Recommendation (Always visible) */}
        <div className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm">
           <h3 className="text-collapse-muted text-sm font-medium uppercase tracking-wider mb-4">Suggested Tactic</h3>
           <div className="space-y-3">
             <div className="flex items-center gap-3 p-3 bg-collapse-bg border border-collapse-border rounded-lg hover:border-collapse-accent transition-colors cursor-pointer group">
               <div className="w-8 h-8 rounded-full bg-collapse-accent/10 flex items-center justify-center text-collapse-accent font-bold group-hover:bg-collapse-accent group-hover:text-white transition-colors">1</div>
               <div>
                 <h4 className="font-medium text-sm">Switch to 5-3-2</h4>
                 <p className="text-xs text-collapse-muted">Reinforce defensive width</p>
               </div>
             </div>
             <div className="flex items-center gap-3 p-3 bg-collapse-bg border border-collapse-border rounded-lg hover:border-collapse-accent transition-colors cursor-pointer group opacity-50 hover:opacity-100">
               <div className="w-8 h-8 rounded-full bg-collapse-purple/10 flex items-center justify-center text-collapse-purple font-bold group-hover:bg-collapse-purple group-hover:text-white transition-colors">2</div>
               <div>
                 <h4 className="font-medium text-sm">Substitute CDM</h4>
                 <p className="text-xs text-collapse-muted">Fresh legs in midfield pivot</p>
               </div>
             </div>
           </div>
        </div>
      </div>

      {/* Center Column: Intervention Card */}
      <div className="col-span-1 flex flex-col justify-center gap-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold font-sans tracking-tight leading-tight">
            Defensive Structure Compromised
          </h2>
          <p className="text-collapse-muted max-w-md mx-auto">
            Our model detected a significant drop in defensive compactness starting at minute 52.
          </p>
        </div>

        <motion.div 
          className="bg-collapse-surface border border-collapse-accent/30 rounded-xl p-8 shadow-lg relative overflow-hidden group"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={120} />
          </div>
          
          <h3 className="text-xl font-bold text-collapse-accent mb-6 flex items-center gap-2">
            <PlayCircle className="w-6 h-6" />
            Proposed Intervention
          </h3>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-collapse-accent/20 text-collapse-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</span>
              <span className="text-collapse-text font-medium">Shift left-back to inverted role</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-collapse-accent/20 text-collapse-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</span>
              <span className="text-collapse-text font-medium">Increase press intensity zone 14</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-collapse-accent/20 text-collapse-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</span>
              <span className="text-collapse-text font-medium">Slow build-up tempo</span>
            </li>
          </ul>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-collapse-border/50">
            <div className="text-sm text-collapse-muted font-medium">Potential Impact</div>
            <div className="bg-collapse-safe/20 text-collapse-safe px-3 py-1.5 rounded-lg font-bold text-sm border border-collapse-safe/30">
              -45% Risk Delta
            </div>
          </div>

          <button 
            onClick={() => setRevealed(true)}
            disabled={revealed}
            className={`w-full mt-6 py-3 rounded-lg font-bold shadow-lg transition-all transform active:scale-95 ${revealed ? 'bg-collapse-border text-collapse-muted cursor-default' : 'bg-collapse-accent text-white hover:bg-collapse-accent/90 shadow-collapse-accent/25'}`}
          >
            {revealed ? "Scenario Rendered" : "Run Simulation: What If?"}
          </button>
        </motion.div>
      </div>

      {/* Right Column: Counterfactual Chart */}
      <div className="col-span-1 bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm flex flex-col relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold font-sans">Simulation Result</h3>
          <Info className="w-5 h-5 text-collapse-muted cursor-help" />
        </div>

           <div className="flex-1 w-full relative min-h-[400px]">
            {/* We use SVG overlay on top of Recharts or just straight SVG for the animation control */}
           {/* Let's try to simulate this with pure SVG/Framer Motion for better animation control than Recharts allows easily */}
           <div className="absolute inset-0 z-10 pointer-events-none">
             {revealed && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 transition={{ delay: 1.2 }}
                 className="absolute top-1/4 left-1/4 bg-collapse-surface/90 backdrop-blur border border-collapse-safe rounded-lg p-3 shadow-xl"
               >
                 <span className="block text-xs text-collapse-muted uppercase font-bold">Projected Outcome</span>
                 <span className="text-lg font-bold text-collapse-safe">-42% Risk</span>
                 <span className="block text-xs text-collapse-muted">If applied at 55'</span>
               </motion.div>
             )}
           </div>

           <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
               <defs>
                 <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                   <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                 </linearGradient>
                 <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                   <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                 </linearGradient>
               </defs>
               <XAxis dataKey="minute" stroke="#334155" tick={{fill: '#475569'}} />
               <YAxis hide domain={[0, 1]} />
               <Tooltip 
                 contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }}
               />
               <ReferenceLine x={55} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: "Intervention", fill: "#F59E0B", fontSize: 10, position: 'insideTopLeft' }} />
               
               {/* Actual Path - Fades out */}
               <Area 
                 type="monotone" 
                 dataKey="actual" 
                 stroke="#94a3b8" 
                 strokeWidth={2}
                 fill="url(#colorActual)" 
                 style={{ opacity: revealed ? 0.4 : 1, transition: 'opacity 1s ease' }}
               />
               
               {/* Goal Marker on Actual Path */}
               <ReferenceLine x={goalMinute} stroke="#EF4444" strokeDasharray="3 3" />

               {/* Projected Path - Animates in */}
               {revealed && (
                 <Area 
                    type="monotone" 
                    dataKey="projected" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    fill="url(#colorProjected)"
                    className="animate-draw-path" // We'd need custom CSS for true path drawing or use the SVG overlay method below
                 />
               )}
             </AreaChart>
           </ResponsiveContainer>
           
           {/* Custom Overlay for the path animation (Framer Motion) */}
           {revealed && (
             <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                {/* This is a simplified representation of the green line for animation purposes 
                    In a real app, we'd calculate the path d string based on the data points 
                */}
                <motion.path 
                  d={`M ${55/80 * 100}% ${80}% Q ${65/80 * 100}% ${85}% ${80/80 * 100}% ${90}%`} // Approximate curve
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeDasharray="10 5"
                  variants={greenPathVariants}
                  initial="hidden"
                  animate="visible"
                  style={{ vectorEffect: 'non-scaling-stroke' }} // Keeps stroke width constant if scaled
                />
                
                {/* Red dot for actual goal */}
                <motion.circle 
                  cx={`${goalMinute/80 * 100}%`} 
                  cy="20%" 
                  r="6" 
                  fill="#EF4444" 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                />
             </svg>
           )}
        </div>
      </div>
    </div>
  );
}
