import React from 'react';
import { Link } from 'react-router';
import { Activity } from 'lucide-react';
import { motion } from 'motion/react';

export function Dashboard() {
  return (
    <div className="h-full min-h-screen p-0 md:p-2">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative min-h-[calc(100vh-1rem)] overflow-hidden rounded-none md:rounded-2xl border border-collapse-border bg-[#061725]"
      >
        {/* layered pitch background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(14,165,233,0.20),transparent_35%),radial-gradient(circle_at_70%_45%,rgba(14,165,233,0.10),transparent_40%)]" />
          <div className="absolute inset-0 opacity-45 [background:repeating-linear-gradient(90deg,rgba(33,95,65,0.35)_0,rgba(33,95,65,0.35)_42px,rgba(18,63,42,0.35)_42px,rgba(18,63,42,0.35)_84px)]" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full border border-white/25" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/45" />
          <div className="absolute top-0 right-0 w-[22%] h-full border-l border-white/20" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[10%] h-[44%] border-l border-y border-white/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#061725]/5 via-transparent to-[#061725]/50" />
        </div>

        <div className="relative z-10 min-h-[calc(100vh-1rem)] px-6 md:px-10 flex items-center justify-center">
          <div className="max-w-[760px] text-center flex flex-col items-center">
            <p className="text-[10px] md:text-xs tracking-[0.35em] text-cyan-300/70 font-semibold">
              HACKLYTICS 2026 · SPORTS ANALYTICS
            </p>
            <h1 className="mt-4 text-5xl md:text-7xl font-black tracking-tight leading-none text-white">
              COLLAPSE<span className="text-sky-400 drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">OS</span>
            </h1>
            <p className="mt-4 text-xl md:text-3xl text-white/85 font-medium">
              Predict the collapse. <span className="font-bold">Before it happens.</span>
            </p>

            <Link
              to="/war-room"
              className="mt-8 inline-flex items-center gap-3 rounded-2xl px-7 py-4 text-sm md:text-lg font-extrabold tracking-wider text-slate-950 bg-[linear-gradient(90deg,#2cc4ff,#1f8cff)] shadow-[0_12px_40px_rgba(56,189,248,0.35)] hover:brightness-110 transition-all"
            >
              <Activity className="w-5 h-5" />
              ANALYZE A MATCH
              <span aria-hidden>→</span>
            </Link>

          </div>
        </div>
      </motion.section>
    </div>
  );
}
