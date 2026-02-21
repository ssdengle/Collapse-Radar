# End-to-end run & test checklist

## 1. Start backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- On first start, the API creates `../data/collapseos.duckdb` and seeds demo data (Spain vs Portugal, timeline 0–95, goals, pass network, WC2026 venues).
- Health: `curl http://localhost:8000/health` → `{"status":"ok","db":"collapseos.duckdb"}`.

## 2. Start frontend

```bash
cd "Frontend UI Design"
# .env should have VITE_API_URL=http://localhost:8000
npm run dev
```

**Open the exact URL Vite prints** (e.g. `http://localhost:5173` or `http://localhost:5175` if 5173 is in use). If you open the wrong port you may see a blank or old app.

## 3. Feature & button mapping checklist

### Dashboard
- [ ] **Stats cards** load from `/api/dashboard/stats`: Matches monitored, High-risk moments (warnings), Model AUC, Avg lead time.
- [ ] **Collapse risk trend** chart uses `/api/match/3943043/timeline?team=Spain` when backend is up; fallback curve when not.
- [ ] **Quick links** go to War Room, Coach Mode, Injury Sim, WC 2026.
- [ ] **Live matches** button links to `/war-room`.
- [ ] **Recent tactical alerts** table is static (no API); left as-is.

### War Room
- [ ] **Match list** from `/api/matches`; clicking a match selects it and loads that match’s view.
- [ ] **Timeline** from `/api/match/{id}/timeline?team=Spain`; chart shows probability per minute.
- [ ] **Goals** from `/api/match/{id}/goals`; vertical lines and ⚽ on chart.
- [ ] **Scrubber** (0’–95’) updates `currentMinute`; gauge and risk drivers update.
- [ ] **Current risk %** and **Risk drivers** from `/api/match/{id}/window/{minute}?team=Spain` (headline, driver_1/2/3, features).
- [ ] **Critical alert** (when risk > 65%) shows `windowData.headline` from API.
- [ ] **Change match** clears selection and shows match picker again.
- [ ] **CUSUM** vertical lines from `timeline[].cusum_flag`.

### Coach Mode
- [ ] **Risk %** and **rationale** bullets from `/api/match/3943043/window/75?team=Spain` (probability, headline, rationale).
- [ ] **Impact: -X% risk delta** from `windowData.risk_delta`.
- [ ] **Tactics** checkboxes (Suggested + Historical) are UI-only; selecting any enables “Compare”.
- [ ] **Compare N tactic(s)** button calls `getCounterfactual(3943043, 75, Spain)` and sets revealed; chart shows **Projected (What If)** series from `/api/match/3943043/counterfactual/75?team=Spain`.
- [ ] **Reset** clears revealed and hides projected series.
- [ ] **Goal** reference line uses first goal minute from `/api/match/3943043/goals`.

### Injury Sim
- [ ] **Squad** (pitch/subs/reserves) and **formation** are local state (createSquad); swap/remove/drag work as before.
- [ ] **Remove** on a pitch player moves them to subs and shows placeholder.
- [ ] **Add to pitch** / **Swap** / **Replace here** work for all positions including GK.
- [ ] **Drag** from subs/reserves onto formation (player or placeholder) fills/replaces slot.
- [ ] **Reset squad** restores initial lineup.
- [ ] **Player card click** opens right panel; **Remove Player** calls `POST /api/match/3943043/simulate_removal` with `{ team: "Spain", player: selectedPlayer.name, minute: 75 }` and shows **Current vs Projected %** and **Delta** from API (`original_probability`, `new_probability`, `delta`).
- [ ] **Reset simulation** clears removal state and restores formation node.

### WC 2026
- [ ] **Venues** (map pins) from `/api/wc2026/venues`; pin color by `stress_factor` (red/amber/green).
- [ ] **Fixture select** (Brazil vs France, etc.) updates selected fixture and baseline venue.
- [ ] **Alternative venue** dropdown refetches `/api/wc2026/fixture?team_a=&team_b=&venue_city=` and shows **Delta** (adjusted_probability - base_probability).
- [ ] **Click pin** sets baseline venue and zooms (MapFlyTo).
- [ ] **CityCard** shows temp, humidity, elevation from API venue.

### Navigation
- [ ] Sidebar: Dashboard, War Room, Coach Mode, Injury Sim, WC 2026.
- [ ] Dashboard quick links and “Live matches” match sidebar routes.

## 4. If backend is not running

- **Dashboard**: Shows “Could not load stats…” and fallback trend curve.
- **War Room**: Shows “Could not load matches…” or “Could not load timeline…”.
- **Coach Mode / Injury Sim / WC 2026**: Use fallbacks or empty data where documented above.

## 5. Troubleshooting

- **Blank or wrong page**: Open the URL Vite prints (e.g. http://localhost:5175), not always 5173.
- **Stats never load**: Run `curl http://localhost:8000/health`; set `VITE_API_URL=http://localhost:8000` in `Frontend UI Design/.env` and restart the frontend if needed.
- **CORS errors**: API allows all origins; see `backend/main.py`.
