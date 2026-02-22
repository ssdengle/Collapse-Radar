import { motion } from 'motion/react';
import {
  Brain, Zap, Users, Globe, BrainCircuit, Swords,
  BarChart3, Radio, TrendingUp, Database, ChevronRight,
  Shield, AlertTriangle, Activity,
} from 'lucide-react';

// ── Section heading ────────────────────────────────────────────────────────
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold text-collapse-text uppercase tracking-widest mb-4 flex items-center gap-2">
      <span className="w-6 h-0.5 bg-collapse-accent inline-block rounded"/>
      {children}
    </h2>
  );
}

// ── Pill badge ─────────────────────────────────────────────────────────────
function Pill({ children, color = 'accent' }: { children: React.ReactNode; color?: string }) {
  const cls =
    color === 'accent'  ? 'bg-collapse-accent/10  border-collapse-accent/25  text-collapse-accent'  :
    color === 'purple'  ? 'bg-purple-500/10        border-purple-500/25        text-purple-400'        :
    color === 'emerald' ? 'bg-emerald-500/10       border-emerald-500/25       text-emerald-400'       :
    color === 'amber'   ? 'bg-amber-500/10         border-amber-500/25         text-amber-400'         :
                          'bg-red-500/10           border-red-500/25           text-red-400';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

// ── Feature card ───────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon, title, description, badge, delay = 0,
}: {
  icon: any; title: string; description: string; badge?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-3 hover:border-collapse-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-xl bg-collapse-accent/10 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-collapse-accent" size={18}/>
        </div>
        {badge && <Pill color="purple">{badge}</Pill>}
      </div>
      <p className="text-sm font-bold text-collapse-text">{title}</p>
      <p className="text-xs text-collapse-muted leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ── Signal row ─────────────────────────────────────────────────────────────
function SignalRow({ label, description, color }: { label: string; description: string; color: string }) {
  return (
    <div className="flex gap-3 bg-collapse-surface rounded-xl px-4 py-3 border border-collapse-border">
      <div className="shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ background: color }}/>
      <div>
        <p className="text-xs font-bold text-collapse-text">{label}</p>
        <p className="text-[11px] text-collapse-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function About() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-8 space-y-12">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-collapse-accent to-purple-600 flex items-center justify-center shadow-lg shadow-collapse-accent/20">
            <Brain className="w-6 h-6 text-white"/>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-collapse-text">
              Collapse<span className="text-collapse-accent">OS</span>
            </h1>
            <p className="text-sm text-collapse-muted">Real-time football collapse intelligence</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-collapse-accent/5 via-purple-500/5 to-transparent border border-collapse-border rounded-2xl p-6">
          <p className="text-sm text-collapse-text leading-relaxed max-w-3xl">
            CollapseOS is a decision-intelligence platform built for football coaches and analysts. It detects when
            a team is on the verge of tactical or psychological collapse — before it happens. Every signal, chart,
            and insight is designed to answer one question: <span className="font-bold text-collapse-accent">What happens next, and why?</span>
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Pill color="accent">WC 2018 · 2022 data</Pill>
            <Pill color="purple">WC 2026 simulation</Pill>
            <Pill color="emerald">StatsBomb open data</Pill>
            <Pill color="amber">Logistic regression model</Pill>
            <Pill color="red">CUSUM change detection</Pill>
          </div>
        </div>
      </motion.div>

      {/* The Problem */}
      <section className="space-y-4">
        <SectionHead>The Problem</SectionHead>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: AlertTriangle, title: 'Collapse is invisible until it\'s too late',
              desc: 'Teams lose momentum gradually, through micro-events coaches can\'t track in real time: turnover clusters, territory drift, fading pass networks.' },
            { icon: BarChart3, title: 'Too many metrics, too few decisions',
              desc: 'Existing analytics tools surface 50+ numbers per match. Coaches need one insight: is my team about to collapse, and who is causing it?' },
            { icon: Activity, title: 'No pre-emptive early warning',
              desc: 'Traditional stats describe what happened. CollapseOS predicts what\'s about to happen using causal feature signals derived from event-level data.' },
          ].map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-2">
              <c.icon className="w-5 h-5 text-collapse-risk"/>
              <p className="text-sm font-bold text-collapse-text">{c.title}</p>
              <p className="text-xs text-collapse-muted leading-relaxed">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-5">
        <SectionHead>How It Works</SectionHead>

        {/* Pipeline */}
        <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-5">
          <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider">Intelligence Pipeline</p>
          <div className="flex items-center gap-2 flex-wrap">
            {['StatsBomb Events', 'Feature Engineering', 'Logistic Regression', 'CUSUM Detection', 'Counterfactual Engine', 'Insights'].map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-collapse-bg border border-collapse-border text-collapse-text">{s}</span>
                {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-collapse-muted shrink-0"/>}
              </div>
            ))}
          </div>
        </div>

        {/* Collapse signals */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider mb-3">Core Collapse Signals</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <SignalRow label="Turnover Burstiness"     color="#ef4444" description="Cluster detection on possession-loss events — a burst of turnovers in 5 minutes is a stronger predictor than frequency alone."/>
            <SignalRow label="Territory Tilt"          color="#f59e0b" description="Sustained shift in where the team is winning/losing duels — directional pressure that compounds into structural vulnerability."/>
            <SignalRow label="Pass Accuracy Slope"     color="#a855f7" description="Rate-of-change in pass completion over a rolling window. A falling slope under pressure signals disorganisation before it becomes visible."/>
            <SignalRow label="Defensive Action Rate"   color="#0ea5e9" description="Volume of forced defensive actions per minute — high rate means the team is absorbing pressure rather than distributing it."/>
            <SignalRow label="Tempo Variance"          color="#22c55e" description="Volatility in match rhythm. High variance = erratic transitions; used as a proxy for psychological instability."/>
            <SignalRow label="Fatigue Transition Rate" color="#f97316" description="Rate at which high-intensity phases end — teams that cycle in and out of intensity rapidly are more collapse-prone."/>
          </div>
        </div>

        {/* Psychological features (new) */}
        <div className="bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400"/>
            <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Psychological &amp; Sentiment Layer (WC 2026 Live Sim)</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Crowd Pressure',      desc: 'Venue + score + rivalry' },
              { label: 'Momentum',            desc: 'Territory × goal recency' },
              { label: 'Psychological Stress',desc: 'Deficit × time pressure' },
              { label: 'Physical Fatigue',    desc: 'Cumulative + sub-dips' },
              { label: 'Rivalry Index',       desc: '15 classic WC matchups' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-collapse-surface border border-purple-500/15 rounded-xl p-3 space-y-1">
                <p className="text-[10px] font-bold text-purple-400">{label}</p>
                <p className="text-[9px] text-collapse-dim leading-tight">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="space-y-4">
        <SectionHead>Platform Features</SectionHead>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard delay={0.00} icon={Swords}       title="War Room"              badge="WC 2018/22"
            description="Per-match collapse probability timeline with CUSUM change-point markers, goal overlays, penalty shootout display, and key moment context panels."/>
          <FeatureCard delay={0.05} icon={BrainCircuit}  title="Coach View"           badge="Decision-first"
            description="Team fingerprint, opponent scouting, matchup simulation, and a counterfactual 'what-if' lever. Outputs 3 causal insights per view — not dashboards."/>
          <FeatureCard delay={0.10} icon={Shield}        title="Lineup Builder"        badge="Coach View"
            description="Build a Starting XI, visualise the pass network and pitch formation, auto-optimise by stability load, and compare collapse risk delta against all WC teams."/>
          <FeatureCard delay={0.15} icon={Users}         title="Player Portal"         badge="Player data"
            description="Individual impact cards, pressure-split analysis, role coaching cues, match-stats radar, player traits, and full WC trajectory with next-match prediction."/>
          <FeatureCard delay={0.20} icon={Globe}         title="WC 2026 Map"           badge="Venues"
            description="Interactive Leaflet map of all 16 WC 2026 host venues. Click a venue to see fixture projections and team collapse risk comparisons per city."/>
          <FeatureCard delay={0.25} icon={Radio}         title="Live Simulation"       badge="New"
            description="Pick any two WC 2026 teams and watch a 90-minute simulated match play out in real time — collapse probability curves, sentiment bars, and live event feed."/>
          <FeatureCard delay={0.30} icon={TrendingUp}    title="Player Trajectory"     badge="Prediction"
            description="Per-match performance arcs pulled from real StatsBomb pass_nodes data. Resilience score, collapse contribution, and next-match performance forecast."/>
          <FeatureCard delay={0.35} icon={BarChart3}     title="Match Replay"         badge="War Room"
            description="Replay any WC 2018/2022 match with annotated collapse events. Click any spike to see the tactical context, pressure window stats, and coaching cues."/>
          <FeatureCard delay={0.40} icon={Zap}           title="Counterfactual Engine" badge="What-if"
            description="Toggle tactical levers (press intensity, defensive depth, sub timing) to see projected collapse risk changes — built on logistic regression counterfactuals."/>
        </div>
      </section>

      {/* Tech stack */}
      <section className="space-y-4">
        <SectionHead>Technology</SectionHead>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-collapse-accent"/>
              <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider">Backend</p>
            </div>
            <div className="space-y-2 text-xs text-collapse-muted">
              {[
                ['FastAPI + Python', 'REST API serving all analytics endpoints'],
                ['DuckDB', 'Embedded analytical DB for in-process WC event queries'],
                ['Logistic Regression', 'Collapse probability model trained on WC 2018/2022 event features'],
                ['CUSUM / ruptures', 'Change-point detection for early warning triggers'],
                ['NetworkX', 'Pass network graph construction and centrality scoring'],
                ['NumPy', 'Feature engineering: gradient, clip, rolling windows'],
                ['StatsBomb Open Data', '2018 & 2022 World Cup event-level match data'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-2">
                  <span className="font-semibold text-collapse-text w-36 shrink-0">{t}</span>
                  <span className="leading-relaxed">{d}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-collapse-accent"/>
              <p className="text-xs font-bold text-collapse-muted uppercase tracking-wider">Frontend</p>
            </div>
            <div className="space-y-2 text-xs text-collapse-muted">
              {[
                ['React + Vite', 'Component-based SPA with hot-module reload'],
                ['Tailwind CSS', 'Class-based dark/light theming with CSS variable overrides'],
                ['Recharts', 'Area, Line, Radar, and Bar charts for all visualisations'],
                ['Framer Motion', 'Page transitions, animated bars, and event feed animations'],
                ['TanStack Query', 'Data fetching, caching, and background refetch logic'],
                ['React Leaflet', 'Interactive WC 2026 venue map with popup projections'],
                ['Custom SVG', 'PitchFormation, PassNetwork, PitchHeatmap, dashboard pitch'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-2">
                  <span className="font-semibold text-collapse-text w-36 shrink-0">{t}</span>
                  <span className="leading-relaxed">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="space-y-4">
        <SectionHead>Data &amp; Model</SectionHead>
        <div className="bg-collapse-surface border border-collapse-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { val: '64',    label: 'WC matches analyzed',     color: 'text-collapse-accent' },
              { val: '6',     label: 'Collapse signal features', color: 'text-purple-400'      },
              { val: '~0.83', label: 'Model AUC (WC held-out)', color: 'text-emerald-400'     },
              { val: '15\'',  label: 'Avg. early-warning lead',  color: 'text-amber-400'       },
            ].map(({ val, label, color }) => (
              <div key={label} className="text-center space-y-1">
                <p className={`text-3xl font-black font-mono ${color}`}>{val}</p>
                <p className="text-[10px] text-collapse-dim uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-collapse-border pt-4 text-xs text-collapse-muted space-y-2 leading-relaxed">
            <p>
              The collapse model is a <span className="text-collapse-text font-semibold">logistic regression</span> trained on per-minute feature vectors from WC 2018 and 2022 matches.
              Features are computed at 1-minute granularity: pass accuracy slope (5-min rolling gradient), turnover burstiness (Poisson-based cluster score),
              territory tilt (duel outcome directional shift), and three more. The model is deliberately simple — interpretability is a core requirement for coaching use.
            </p>
            <p>
              <span className="text-collapse-text font-semibold">CUSUM change-point detection</span> (via the <code className="text-collapse-accent text-[10px] bg-collapse-bg px-1 py-0.5 rounded">ruptures</code> library)
              fires early-warning triggers 10–20 minutes before a statistically significant probability shift, giving coaches actionable lead time.
            </p>
            <p>
              <span className="text-collapse-text font-semibold">WC 2026 simulations</span> use WC 2018/2022 team fingerprints as priors. If a team has no historical WC record,
              a deterministic synthetic fingerprint is derived from the team name seed. All simulation data is clearly labeled as synthetic.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-collapse-border pt-6 pb-2 flex items-center justify-between">
        <p className="text-[10px] text-collapse-dim">Built for Hacklytics 2026 · CollapseOS</p>
        <p className="text-[10px] text-collapse-dim">Data: StatsBomb Open Data · WC 2018 &amp; 2022</p>
      </div>
    </div>
  );
}
