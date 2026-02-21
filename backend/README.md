# CollapseOS Backend

FastAPI backend for the Collapse Radar frontend. Serves match timelines, goals, risk windows, counterfactuals, pass network, and WC2026 venues from DuckDB.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Seed database (run once)

If you have [StatsBomb open-data](https://github.com/statsbomb/open-data) in `../data/raw/` (e.g. `events/3943043.json`, `lineups/3943043.json`, `matches/<comp_id>/<season_id>.json`), precompute will use it. Otherwise it seeds a minimal demo (Spain vs Portugal, timeline 0–95, one goal at 67', pass network at 75', WC2026 venues).

```bash
python precompute.py
```

This creates `../data/collapseos.duckdb`.

## Run API

```bash
uvicorn main:app --reload --port 8000
```

Then open the frontend (e.g. `cd "Frontend UI Design" && npm run dev`) and set `VITE_API_URL=http://localhost:8000` in `.env`.

## Endpoints

- `GET /api/matches` — list matches
- `GET /api/dashboard/stats` — dashboard stats + demo match
- `GET /api/match/{id}/timeline?team=Spain` — collapse probability per minute + cusum_flag
- `GET /api/match/{id}/goals` — goals
- `GET /api/match/{id}/window/{minute}?team=Spain` — risk drivers, headline, rationale
- `GET /api/match/{id}/counterfactual/{minute}?team=Spain` — projected risk curve
- `GET /api/match/{id}/network/{minute}?team=Spain` — pass network nodes/edges
- `POST /api/match/{id}/simulate_removal` — body `{ "team", "player", "minute" }` → removal impact
- `GET /api/wc2026/venues` — WC2026 host cities + stress
- `GET /api/wc2026/fixture?team_a=&team_b=&venue_city=` — fixture comparison at venue
