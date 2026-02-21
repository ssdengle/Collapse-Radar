import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, ShieldAlert, Activity, ArrowUpRight, ArrowDownRight, Server, Users } from 'lucide-react';
import { motion } from 'motion/react';

const data = [
  { name: '00:00', load: 45, traffic: 2400 },
  { name: '04:00', load: 55, traffic: 1398 },
  { name: '08:00', load: 35, traffic: 9800 },
  { name: '12:00', load: 70, traffic: 3908 },
  { name: '16:00', load: 60, traffic: 4800 },
  { name: '20:00', load: 85, traffic: 3800 },
  { name: '23:59', load: 50, traffic: 4300 },
];

const threatData = [
  { name: 'Mon', critical: 4, warning: 12, info: 45 },
  { name: 'Tue', critical: 2, warning: 15, info: 38 },
  { name: 'Wed', critical: 7, warning: 8, info: 52 },
  { name: 'Thu', critical: 3, warning: 22, info: 41 },
  { name: 'Fri', critical: 5, warning: 18, info: 36 },
  { name: 'Sat', critical: 1, warning: 5, info: 24 },
  { name: 'Sun', critical: 2, warning: 7, info: 28 },
];

export function Dashboard() {
  return (
    <div className="p-6 space-y-6 text-collapse-text min-h-screen bg-collapse-bg">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">System Overview</h1>
          <p className="text-collapse-muted mt-1 font-mono text-sm">Real-time monitoring dashboard</p>
        </div>
        <div className="flex gap-3">
           <button className="px-4 py-2 bg-collapse-surface border border-collapse-border rounded-lg hover:bg-collapse-border transition-colors text-sm font-medium flex items-center gap-2">
             <Activity className="w-4 h-4 text-collapse-accent" />
             Live Status
           </button>
           <button className="px-4 py-2 bg-collapse-accent text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium shadow-lg shadow-collapse-accent/20">
             Generate Report
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="System Health" 
          value="98.2%" 
          trend="+1.2%" 
          trendUp={true} 
          icon={<CheckCircle className="w-5 h-5 text-collapse-safe" />}
          color="safe"
        />
        <StatCard 
          title="Active Threats" 
          value="3 Detected" 
          trend="+2" 
          trendUp={false} 
          icon={<ShieldAlert className="w-5 h-5 text-collapse-risk" />} 
          color="risk"
        />
        <StatCard 
          title="Server Load" 
          value="64%" 
          trend="-5%" 
          trendUp={true} 
          icon={<Server className="w-5 h-5 text-collapse-warn" />} 
          color="warn"
        />
        <StatCard 
          title="Active Users" 
          value="1,248" 
          trend="+12%" 
          trendUp={true} 
          icon={<Users className="w-5 h-5 text-collapse-purple" />} 
          color="purple"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2 bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-semibold font-sans">Network Traffic & Load</h3>
             <div className="flex gap-2">
               <span className="flex items-center gap-1 text-xs text-collapse-muted"><div className="w-2 h-2 rounded-full bg-collapse-accent"></div> Traffic</span>
               <span className="flex items-center gap-1 text-xs text-collapse-muted"><div className="w-2 h-2 rounded-full bg-collapse-purple"></div> Load</span>
             </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }}
                  itemStyle={{ color: '#E2E8F0' }}
                />
                <Area type="monotone" dataKey="traffic" stroke="#0EA5E9" strokeWidth={2} fillOpacity={1} fill="url(#colorTraffic)" />
                <Area type="monotone" dataKey="load" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm"
        >
          <h3 className="text-lg font-semibold font-sans mb-6">Threat Analysis</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={threatData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#334155', opacity: 0.2}}
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#E2E8F0' }}
                />
                <Legend />
                <Bar dataKey="critical" name="Critical" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="warning" name="Warning" fill="#F59E0B" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="info" name="Info" fill="#0EA5E9" radius={[0, 0, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Logs Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-collapse-surface border border-collapse-border rounded-xl overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-collapse-border flex justify-between items-center">
          <h3 className="text-lg font-semibold font-sans">Recent System Logs</h3>
          <button className="text-sm text-collapse-accent hover:text-collapse-accent/80 font-medium">View All Logs</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-collapse-bg text-collapse-muted font-medium font-mono uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Level</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-collapse-border">
              {[
                { time: '2023-10-24 14:32:01', level: 'CRITICAL', source: 'Firewall-01', msg: 'Unusual outbound traffic detected on port 443', status: 'Pending' },
                { time: '2023-10-24 14:30:15', level: 'WARNING', source: 'AuthService', msg: 'Multiple failed login attempts from IP 192.168.1.45', status: 'Resolved' },
                { time: '2023-10-24 14:28:44', level: 'INFO', source: 'LoadBalancer', msg: 'Node-3 added to cluster pool', status: 'Completed' },
                { time: '2023-10-24 14:15:22', level: 'INFO', source: 'Database', msg: 'Backup completed successfully', status: 'Completed' },
                { time: '2023-10-24 13:55:10', level: 'WARNING', source: 'AppServer-02', msg: 'High memory usage alert (85%)', status: 'Investigating' },
              ].map((log, i) => (
                <tr key={i} className="hover:bg-collapse-bg/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-collapse-muted">{log.time}</td>
                  <td className="px-6 py-4">
                    <Badge level={log.level} />
                  </td>
                  <td className="px-6 py-4 font-mono">{log.source}</td>
                  <td className="px-6 py-4 text-collapse-text">{log.msg}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                      ${log.status === 'Resolved' || log.status === 'Completed' ? 'bg-collapse-safe/10 text-collapse-safe' : 
                        log.status === 'Pending' || log.status === 'Investigating' ? 'bg-collapse-warn/10 text-collapse-warn' : 'bg-collapse-muted/10 text-collapse-muted'}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon, color }: { title: string, value: string, trend: string, trendUp: boolean, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    safe: 'bg-collapse-safe/10 text-collapse-safe border-collapse-safe/20',
    risk: 'bg-collapse-risk/10 text-collapse-risk border-collapse-risk/20',
    warn: 'bg-collapse-warn/10 text-collapse-warn border-collapse-warn/20',
    purple: 'bg-collapse-purple/10 text-collapse-purple border-collapse-purple/20',
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-collapse-surface border border-collapse-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <div className={`flex items-center text-sm font-medium ${trendUp ? 'text-collapse-safe' : 'text-collapse-risk'}`}>
          {trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
          {trend}
        </div>
      </div>
      <h3 className="text-collapse-muted text-sm font-medium uppercase tracking-wider font-mono mb-1">{title}</h3>
      <p className="text-3xl font-bold text-collapse-text font-sans">{value}</p>
    </motion.div>
  );
}

function Badge({ level }: { level: string }) {
  const styles = {
    CRITICAL: "bg-collapse-risk/20 text-collapse-risk border border-collapse-risk/30",
    WARNING: "bg-collapse-warn/20 text-collapse-warn border border-collapse-warn/30",
    INFO: "bg-collapse-accent/20 text-collapse-accent border border-collapse-accent/30",
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-bold font-mono tracking-wide ${styles[level as keyof typeof styles] || "bg-gray-800 text-gray-400"}`}>
      {level}
    </span>
  );
}
