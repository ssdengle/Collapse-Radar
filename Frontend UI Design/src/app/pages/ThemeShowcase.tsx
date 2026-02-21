import { useState } from "react";

const theme = {
  // ── BACKGROUNDS ──
  bg: {
    base:    "#080D14",   // void black — main app background
    surface: "#0D1520",   // cards, panels
    elevated:"#111B2A",   // modals, dropdowns
    border:  "#1C2D40",   // subtle dividers
    hover:   "#162236",   // hover state
  },
  // ── RISK SPECTRUM (the hero palette) ──
  risk: {
    safe:    "#0BDE8C",   // 0–40% — mint green
    safe_bg: "#0BDE8C18",
    caution: "#F5A623",   // 40–65% — amber
    caution_bg:"#F5A62318",
    danger:  "#FF3B5C",   // 65–85% — hot red
    danger_bg: "#FF3B5C18",
    critical:"#FF0A3C",   // 85–100% — pure alarm red
    critical_bg:"#FF0A3C22",
  },
  // ── BRAND ACCENTS ──
  accent: {
    primary:  "#0EA5E9",  // sky blue — probability curve, links
    secondary:"#7C3AED",  // deep violet — WC2026 elements
    cusum:    "#34D399",  // emerald — CUSUM change-point line
    counter:  "#0BDE8C",  // counterfactual green curve
    actual:   "#64748B",  // grey — actual path (faded)
    goal:     "#FF3B5C",  // goal marker red
  },
  // ── TEXT ──
  text: {
    primary:  "#F1F5F9",  // near white — headings
    secondary:"#94A3B8",  // slate — body, labels
    muted:    "#475569",  // dim — timestamps, metadata
    inverse:  "#080D14",  // on light backgrounds
  },
  // ── DATA VIZ ──
  chart: {
    grid:     "#1C2D40",
    axis:     "#2D4156",
    curve:    "#0EA5E9",
    fill:     "#0EA5E912",
    goalLine: "#FF3B5C",
    cusumDot: "#34D399",
    greenCurve:"#0BDE8C",
    greyCurve: "#475569",
  }
};

function ColorSwatch({ hex, name, desc, size = "normal" }: { hex: string, name: string, desc: string, size?: "normal" | "large" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div
      onClick={copy}
      className="cursor-pointer group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-all"
    >
      <div
        className="rounded-md flex-shrink-0 transition-transform group-hover:scale-110"
        style={{
          backgroundColor: hex,
          width: size === "large" ? 48 : 32,
          height: size === "large" ? 48 : 32,
          boxShadow: `0 0 12px ${hex}55`,
        }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-300">{hex}</span>
          {copied && <span className="text-xs text-emerald-400">copied</span>}
        </div>
        <div className="text-xs text-slate-500 truncate">{name}</div>
      </div>
    </div>
  );
}

function Section({ title, accent = "#0EA5E9", children }: { title: string, accent?: string, children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${accent}44, transparent)` }} />
        <span className="text-xs font-mono tracking-widest uppercase" style={{ color: accent }}>
          {title}
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${accent}44, transparent)` }} />
      </div>
      <div className="grid grid-cols-2 gap-1">
        {children}
      </div>
    </div>
  );
}

function RiskBar({ label, pct }: { label: string, pct: number }) {
  const color = pct < 40 ? theme.risk.safe : pct < 65 ? theme.risk.caution : pct < 85 ? theme.risk.danger : theme.risk.critical;
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-400 font-mono">{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: theme.bg.border }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${color}99, ${color})`,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

function LiveDemo() {
  const [minute, setMinute] = useState(75);
  const prob = minute < 30 ? 18 : minute < 50 ? 28 : minute < 65 ? 42 : minute < 73 ? 58 : minute < 78 ? 71 : minute < 85 ? 63 : 77;
  const riskColor = prob < 40 ? theme.risk.safe : prob < 65 ? theme.risk.caution : theme.risk.danger;

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: theme.bg.border, background: theme.bg.surface }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.bg.border }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: theme.risk.danger }} />
          <span className="text-xs font-mono text-slate-400">LIVE · Spain vs Germany · {minute}'</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: theme.accent.cusum }} />
          <span className="text-xs font-mono" style={{ color: theme.accent.cusum }}>CUSUM ACTIVE</span>
        </div>
      </div>

      {/* Mini waveform */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-end gap-0.5 h-16 mb-2">
          {Array.from({ length: 90 }, (_, i) => {
            const p = i < 30 ? 18 : i < 50 ? 28 : i < 65 ? 42 : i < 73 ? 58 : i < 78 ? 71 : i < 85 ? 63 : 77;
            const noise = Math.sin(i * 2.3) * 5;
            const h = Math.max(4, p + noise);
            const isGoal = i === 89;
            const isCusum = i === 73;
            const isNow = i === minute;
            const barColor = isGoal ? theme.risk.danger : isCusum ? theme.accent.cusum : p < 40 ? theme.risk.safe : p < 65 ? theme.risk.caution : theme.risk.danger;
            return (
              <div
                key={i}
                onClick={() => setMinute(i)}
                className="flex-1 rounded-sm cursor-pointer transition-all hover:opacity-100"
                style={{
                  height: `${(h / 100) * 100}%`,
                  background: isNow ? "#fff" : `${barColor}${isGoal ? "ff" : "88"}`,
                  minHeight: 2,
                  opacity: isNow ? 1 : 0.7,
                }}
              />
            );
          })}
        </div>

        <input
          type="range" min={0} max={89} value={minute}
          onChange={e => setMinute(+e.target.value)}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: theme.accent.primary }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs font-mono text-slate-600">0'</span>
          <span className="text-xs font-mono text-slate-600">90'</span>
        </div>
      </div>

      <div className="px-4 pb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 font-mono mb-1">COLLAPSE RISK</div>
          <div className="text-4xl font-bold font-mono" style={{ color: riskColor, textShadow: `0 0 20px ${riskColor}66` }}>
            {prob}%
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 font-mono mb-1">STATUS</div>
          <div className="text-sm font-mono px-3 py-1 rounded-full border" style={{
            color: riskColor,
            borderColor: `${riskColor}44`,
            background: `${riskColor}11`,
          }}>
            {prob < 40 ? "STABLE" : prob < 65 ? "ELEVATED" : "⚠ DANGER"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CollapseOSTheme() {
  return (
    <div className="min-h-screen font-mono" style={{ background: theme.bg.base, color: theme.text.primary }}>

      {/* Header */}
      <div className="border-b" style={{ borderColor: theme.bg.border }}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs tracking-widest text-slate-500 mb-2">HACKLYTICS 2026 · SPORTS ANALYTICS</div>
              <h1 className="text-5xl font-bold tracking-tight mb-1" style={{
                background: `linear-gradient(135deg, ${theme.text.primary} 0%, ${theme.accent.primary} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                CollapseOS
              </h1>
              <div className="text-sm" style={{ color: theme.accent.primary }}>Design System & Color Reference</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-600 mb-1">DESIGN LANGUAGE</div>
              <div className="text-sm text-slate-400">Tactical Dark</div>
              <div className="text-xs text-slate-600 mt-1">Mission Control × Sports Data</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left — Swatches */}
          <div>
            <Section title="Backgrounds" accent={theme.accent.primary}>
              <ColorSwatch hex={theme.bg.base}     name="bg.base"    desc="App background" />
              <ColorSwatch hex={theme.bg.surface}  name="bg.surface" desc="Cards & panels" />
              <ColorSwatch hex={theme.bg.elevated} name="bg.elevated"desc="Modals" />
              <ColorSwatch hex={theme.bg.border}   name="bg.border"  desc="Dividers" />
              <ColorSwatch hex={theme.bg.hover}    name="bg.hover"   desc="Hover states" />
            </Section>

            <Section title="Risk Spectrum" accent={theme.risk.danger}>
              <ColorSwatch hex={theme.risk.safe}     name="risk.safe"     desc="0–40%" size="large" />
              <ColorSwatch hex={theme.risk.caution}  name="risk.caution"  desc="40–65%" size="large" />
              <ColorSwatch hex={theme.risk.danger}   name="risk.danger"   desc="65–85%" size="large" />
              <ColorSwatch hex={theme.risk.critical} name="risk.critical" desc="85–100%" size="large" />
            </Section>

            <Section title="Accents" accent={theme.accent.secondary}>
              <ColorSwatch hex={theme.accent.primary}   name="accent.primary"   desc="Curve, links" />
              <ColorSwatch hex={theme.accent.secondary} name="accent.secondary" desc="WC2026 elements" />
              <ColorSwatch hex={theme.accent.cusum}     name="accent.cusum"     desc="Momentum shift" />
              <ColorSwatch hex={theme.accent.counter}   name="accent.counter"   desc="Counterfactual" />
              <ColorSwatch hex={theme.accent.actual}    name="accent.actual"    desc="Actual path" />
              <ColorSwatch hex={theme.accent.goal}      name="accent.goal"      desc="Goal markers" />
            </Section>

            <Section title="Typography" accent={theme.text.secondary}>
              <ColorSwatch hex={theme.text.primary}   name="text.primary"   desc="Headings" />
              <ColorSwatch hex={theme.text.secondary} name="text.secondary" desc="Body" />
              <ColorSwatch hex={theme.text.muted}     name="text.muted"     desc="Metadata" />
            </Section>
          </div>

          {/* Right — Live Previews */}
          <div>
            <div className="text-xs tracking-widest text-slate-500 mb-4 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${theme.accent.primary}44, transparent)` }} />
              <span style={{ color: theme.accent.primary }}>LIVE PREVIEW</span>
              <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${theme.accent.primary}44, transparent)` }} />
            </div>

            {/* War Room mini demo */}
            <div className="mb-6">
              <div className="text-xs text-slate-500 mb-2">War Room — drag the scrubber</div>
              <LiveDemo />
            </div>

            {/* Risk bars */}
            <div className="rounded-xl border p-4 mb-6" style={{ borderColor: theme.bg.border, background: theme.bg.surface }}>
              <div className="text-xs text-slate-500 mb-4">Risk Driver Bars</div>
              <RiskBar label="turnover_burstiness"     pct={82} />
              <RiskBar label="territory_tilt"          pct={71} />
              <RiskBar label="defensive_actions_pm"    pct={65} />
              <RiskBar label="pass_accuracy_slope"     pct={44} />
              <RiskBar label="final_third_entries_pm"  pct={38} />
            </div>

            {/* Coach Mode card */}
            <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: theme.bg.border, background: theme.bg.surface }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: theme.bg.border }}>
                <span className="text-xs text-slate-400 tracking-wider">TACTICAL INTERVENTION</span>
                <div className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `${theme.risk.safe}22`, color: theme.risk.safe }}>
                  −23% risk
                </div>
              </div>
              <div className="p-4">
                <div className="text-base font-bold mb-3" style={{ color: theme.text.primary }}>
                  Reduce central build-up immediately
                </div>
                <div className="space-y-2">
                  {[
                    "Clustered possession losses signal midfield overload",
                    "Increase long outlet passes — relieve central pressure",
                    "Lower press intensity for 5 minutes — recover shape",
                  ].map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: theme.accent.primary }} />
                      <span className="text-xs" style={{ color: theme.text.secondary }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Typography scale */}
            <div className="rounded-xl border p-4" style={{ borderColor: theme.bg.border, background: theme.bg.surface }}>
              <div className="text-xs text-slate-500 mb-4">Typography</div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-600 mb-0.5">Display / Probability number</div>
                  <div className="text-5xl font-bold" style={{ color: theme.risk.danger, fontFamily: "monospace", textShadow: `0 0 20px ${theme.risk.danger}55` }}>71%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-600 mb-0.5">Screen heading</div>
                  <div className="text-xl font-bold tracking-tight" style={{ color: theme.text.primary }}>CollapseOS War Room</div>
                </div>
                <div>
                  <div className="text-xs text-slate-600 mb-0.5">Label / Mono UI</div>
                  <div className="text-xs tracking-widest uppercase" style={{ color: theme.accent.primary, fontFamily: "monospace" }}>Collapse Probability · Minute 75</div>
                </div>
                <div>
                  <div className="text-xs text-slate-600 mb-0.5">Body text</div>
                  <div className="text-sm" style={{ color: theme.text.secondary }}>Turnover burstiness spiked at minute 73. Territory tilt shifted 8 metres toward own goal.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full palette strip */}
        <div className="mt-10 mb-2">
          <div className="text-xs text-slate-500 tracking-widest mb-4 text-center">COMPLETE PALETTE STRIP</div>
          <div className="flex rounded-xl overflow-hidden h-12">
            {[
              theme.bg.base, theme.bg.surface, theme.bg.elevated, theme.bg.border,
              theme.risk.safe, theme.risk.caution, theme.risk.danger, theme.risk.critical,
              theme.accent.primary, theme.accent.secondary, theme.accent.cusum,
              theme.text.secondary, theme.text.muted,
            ].map((hex, i) => (
              <div key={i} className="flex-1 cursor-pointer hover:scale-y-125 transition-transform origin-bottom"
                style={{ background: hex }}
                onClick={() => { navigator.clipboard.writeText(hex); }}
                title={hex}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-slate-600">Backgrounds →</span>
            <span className="text-xs text-slate-600">← Risk Spectrum →</span>
            <span className="text-xs text-slate-600">← Accents</span>
          </div>
        </div>

        {/* Tailwind config */}
        <div className="mt-10 rounded-xl border overflow-hidden" style={{ borderColor: theme.bg.border }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: theme.bg.border, background: theme.bg.surface }}>
            <span className="text-xs tracking-wider text-slate-400">TAILWIND CONFIG — PASTE INTO tailwind.config.ts</span>
            <div className="flex gap-1">
              {[theme.risk.danger, theme.risk.caution, theme.risk.safe].map((c, i) => (
                <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
              ))}
            </div>
          </div>
          <pre className="p-4 text-xs overflow-x-auto" style={{ background: theme.bg.elevated, color: theme.accent.primary }}>
{`colors: {
  collapse: {
    // Backgrounds
    base:      '${theme.bg.base}',
    surface:   '${theme.bg.surface}',
    elevated:  '${theme.bg.elevated}',
    border:    '${theme.bg.border}',
    hover:     '${theme.bg.hover}',
    // Risk spectrum
    safe:      '${theme.risk.safe}',
    caution:   '${theme.risk.caution}',
    danger:    '${theme.risk.danger}',
    critical:  '${theme.risk.critical}',
    // Accents
    primary:   '${theme.accent.primary}',
    violet:    '${theme.accent.secondary}',
    cusum:     '${theme.accent.cusum}',
    counter:   '${theme.accent.counter}',
    goal:      '${theme.accent.goal}',
    // Text
    text:      '${theme.text.primary}',
    muted:     '${theme.text.secondary}',
    dim:       '${theme.text.muted}',
  }
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
