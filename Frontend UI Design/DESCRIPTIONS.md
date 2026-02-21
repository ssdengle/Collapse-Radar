# Collapse-Radar — Screen & Metric Descriptions

**What the app is:** Collapse-Radar (CollapseOS) is a football analytics platform that predicts and monitors **collapse risk**—the probability a team concedes or loses control during a match. It combines live match data, pass networks, and environmental factors (e.g. WC 2026 venues) to support coaches and analysts with real-time alerts and what-if simulations.

---

## Dashboard (System Overview)

**What this screen is:** High-level monitoring. It shows platform health and activity (or can be repurposed for match-level KPIs). Use it to see at a glance whether the system and key metrics are normal.

| Item | What it is |
|------|------------|
| **System Health** (e.g. 98.2%) | Overall platform availability or uptime. Trend: change vs previous period. |
| **Active Threats** (e.g. 3 Detected) | Number of current security or anomaly alerts. Trend: increase/decrease in count. |
| **Server Load** (e.g. 64%) | CPU or resource utilization of the backend. Lower is better; trend shows improvement or degradation. |
| **Active Users** (e.g. 1,248) | Number of users or sessions currently using the platform. Trend: growth or drop. |
| **Network Traffic & Load** (chart) | **Traffic:** request volume or data flow over time (e.g. API calls). **Load:** server load over the same time buckets (e.g. 00:00–23:59). Both help spot peaks and patterns. |
| **Threat Analysis** (bar chart) | Stacked bars per day: **Critical** (red), **Warning** (amber), **Info** (blue) event counts. Summarizes alert severity over the week. |
| **Recent System Logs** (table) | Latest log entries: timestamp, level (CRITICAL/WARNING/INFO), source (service name), message, and status (Pending, Resolved, Investigating, Completed). |

---

## War Room

**What this screen is:** Live match view for a single game. You see collapse risk over match time, goals, and tactical alerts so staff can react in real time.

| Item | What it is |
|------|------------|
| **Match header** (e.g. FRA vs ARG, 3–3, 118:42) | Current fixture, score, and match clock (including stoppage). |
| **High Risk Mode** (badge) | Indicates the model has detected elevated collapse probability for the current moment. |
| **Collapse Risk % (chart)** | Probability of collapse (conceding or losing structure) at each minute. Blue area; you scrub by minute. |
| **Current Time** (vertical line) | Slider position: the minute you’re viewing. Risk gauge and alerts are for this minute. |
| **Goal markers** (vertical lines + ⚽) | Minute of each goal; red line. Helps correlate risk spikes with goals. |
| **Collapse Probability** (gauge, e.g. 65%) | Risk at the selected minute. Color: green (low), amber (medium), red (high). |
| **Critical Alert** (card) | Short tactical warning when risk is high (e.g. defensive line compromised, flank overload). |
| **Top Risk Drivers** (bars, %) | **Defensive Fatigue**, **Midfield Gaps**, **Press Intensity Drop**—each as a share (e.g. 85%, 72%, 64%) of the current risk. Shows what’s driving the number. |
| **Territory Tilt** (pitch) | Simplified view of where pressure or danger is concentrated (e.g. “Deep Pressure” zone). |

---

## Coach Mode

**What this screen is:** “What-if” mode. It shows current risk, suggests interventions, and runs a simulation (e.g. tactical change at 55') to show projected vs actual collapse risk.

| Item | What it is |
|------|------------|
| **Current Risk Level** (e.g. 72%, HIGH) | Probability of conceding within the next 10 minutes. Trend (e.g. +14%) is the recent change. |
| **Lead Time Estimate** (e.g. 8.5 mins) | Time until the model expects risk to cross a critical threshold if nothing changes. |
| **Suggested Tactic** (cards) | Ranked options (e.g. 1: Switch to 5-3-2, 2: Substitute CDM) with short rationale (e.g. “Reinforce defensive width”). |
| **Proposed Intervention** (bullets) | Concrete actions (e.g. shift left-back to inverted role, increase press in zone 14, slow build-up). |
| **Potential Impact** (e.g. -45% Risk Delta) | Estimated reduction in collapse risk if the intervention is applied. |
| **Run Simulation: What If?** (button) | Runs the counterfactual: risk path **if** the intervention is applied at the chosen minute (e.g. 55'). |
| **Simulation Result** (chart) | **Actual:** gray—realized risk over time. **Projected:** green—risk path after the intervention. **Intervention** line: minute of the change. **Goal** line: when the goal actually happened. **Projected Outcome** (e.g. -42% Risk): summary of the simulated impact. |

---

## Injury Sim

**What this screen is:** Pass network and squad load view. You pick a player and simulate removing them to see how much collapse risk and structure would change.

| Item | What it is |
|------|------------|
| **Squad Status** (sidebar) | List of players with **Fatigue** (0–100%, workload/biometric proxy) and **Position**. Color: green → amber → red by fatigue. |
| **Force-directed graph** | **Nodes:** players; **size** = influence (importance in the network); **color** = fatigue. **Edges:** pass links; **thickness** = volume. Draggable. |
| **Pass Completion** (e.g. 87%) | For the selected player: share of passes completed in the match (or window). |
| **Key Passes** (e.g. 4) | For the selected player: passes that lead directly to a shot or big chance. |
| **Remove Player** (button) | Runs the simulation: “What if this player leaves the pitch?” |
| **Collapse Probability Before vs After** | **Current** (e.g. 12%): risk with full XI. **Projected** (e.g. 35%): risk after removing the selected player. Shows how critical they are. |
| **Structural Integrity Critical** | Message that losing this player creates major gaps (e.g. in a sector). |
| **Momentum Shift** | e.g. “Expected possession drops by 14%” after the removal. |

---

## WC 2026 Context

**What this screen is:** Environmental stress for FIFA World Cup 2026 venues. Compare two host cities to see how heat, humidity, and elevation might affect collapse risk.

| Item | What it is |
|------|------------|
| **Map markers** | Each dot is a host city; **color** = stress tier (green Low, amber Medium, red High/Critical). Click to set “Baseline Venue”. |
| **Fixture Select** | Choose a fixture (e.g. Brazil vs France, June 18, 2026) so comparisons are in match context. |
| **Baseline Venue / Alternative** (cards) | Two venues compared. Each card shows **Temp**, **Humidity**, **Elevation**. Side bar color = stress level. |
| **Predicted Collapse Probability Shift** (e.g. +18%, -14%, +2%) | **Environmental delta only:** how much collapse risk is estimated to change if the match were played in the alternative venue instead of the baseline. Positive = higher risk (e.g. harsher conditions), negative = lower. |

---

## Other screens

- **Settings:** Account and app preferences (profile, notifications, security, network, privacy).
- **Theme Showcase:** UI theme and component demo (CollapseOS design system).
- **NotFound:** 404 page when the route doesn’t exist.

---

Use this doc for tooltips, onboarding, or backend copy. You can paste the “What it is” sentences next to stats or into `title`/`aria-label` for accessibility.
