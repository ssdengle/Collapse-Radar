# CollapseOS Backend

FastAPI + DuckDB backend for the CollapseOS frontend.

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## StatsBomb Open Data (optional)

To use **real match and event data** from [StatsBomb Open Data](https://github.com/statsbomb/open-data):

```bash
# Download competitions, matches (La Liga, Premier League, World Cup), and events for first 10 matches
python scripts/fetch_statsbomb_open_data.py

# Matches only (no event files)
python scripts/fetch_statsbomb_open_data.py --events 0

# Events for first 30 matches (larger dataset)
python scripts/fetch_statsbomb_open_data.py --events 30
```

Data is saved under `data/raw/statsbomb/`. The ingestion layer and `precompute.py` will use it when building the database.

## Create the database

**Option A – Full precompute (with or without StatsBomb data)**  
Run once; uses StatsBomb data if present, else synthetic:

```bash
python precompute.py
```

**Option B – Seed minimal DB for demo**  
If `precompute.py` fails, create a minimal DB so the API works:

```bash
python seed_demo_db.py
```

## Run the API

```bash
uvicorn main:app --reload --port 8000
```

- API base: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

## Verify

```bash
curl http://localhost:8000/api/matches
curl "http://localhost:8000/api/match/3943043/timeline?team=Spain"
```

Frontend should use `VITE_API_URL=http://localhost:8000` (see `Frontend UI Design/.env`).

## Coach Mode – AI suggestions (optional)

The Coach Mode “Get AI suggestions” button uses **Google Gemini** to generate tactical recommendations. To enable it:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it when running the backend:

   ```bash
   export GEMINI_API_KEY=your_key_here
   uvicorn main:app --reload --port 8000
   ```

   Or add `GEMINI_API_KEY=...` to a `.env` file in `backend/` and load it (e.g. with `python-dotenv`). If unset, the UI shows a message asking you to set `GEMINI_API_KEY`.
