"""Load match and event data from StatsBomb Open Data (or synthetic) and WC2026 venue data.

StatsBomb Open Data: https://github.com/statsbomb/open-data
Download with: python scripts/fetch_statsbomb_open_data.py
"""
import json
import os
import pandas as pd
import numpy as np

# Demo match ID used across the app (can be overridden by StatsBomb data)
DEMO_MATCH_ID = 3943043
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
STATSBOMB_DIR = os.path.join(DATA_DIR, "statsbomb")


def _load_statsbomb_matches() -> pd.DataFrame | None:
    """Load all matches from downloaded StatsBomb match JSONs."""
    matches_dir = os.path.join(STATSBOMB_DIR, "matches")
    if not os.path.isdir(matches_dir):
        return None
    rows = []
    for comp_id in os.listdir(matches_dir):
        comp_path = os.path.join(matches_dir, comp_id)
        if not os.path.isdir(comp_path):
            continue
        for fname in os.listdir(comp_path):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(comp_path, fname)
            try:
                with open(path) as f:
                    arr = json.load(f)
                for m in arr:
                    home = m.get("home_team", {})
                    away = m.get("away_team", {})
                    comp = m.get("competition", {})
                    season = m.get("season", {})
                    rows.append({
                        "match_id": m["match_id"],
                        "competition": comp.get("competition_name", ""),
                        "season": season.get("season_name", ""),
                        "home_team": home.get("home_team_name", ""),
                        "away_team": away.get("away_team_name", ""),
                        "home_score": m.get("home_score", 0),
                        "away_score": m.get("away_score", 0),
                        "match_date": m.get("match_date", ""),
                        "is_demo_match": m["match_id"] == DEMO_MATCH_ID,
                    })
            except Exception:
                continue
    if not rows:
        return None
    return pd.DataFrame(rows)


def _load_statsbomb_events(match_id: int) -> pd.DataFrame | None:
    """Load events for one match from downloaded StatsBomb events JSON."""
    path = os.path.join(STATSBOMB_DIR, "events", f"{match_id}.json")
    if not os.path.isfile(path):
        return None
    try:
        with open(path) as f:
            events = json.load(f)
    except Exception:
        return None
    if not events:
        return None
    # Flatten to rows: minute, second, period, type, team (name), possession_team (name), player (name)
    team_names = {}  # id -> name, we may need to get from first event or lineup
    rows = []
    for ev in events:
        minute = ev.get("minute")
        if minute is None:
            continue
        # Normalize to 0–90+ (period 2 starts at 45)
        period = ev.get("period", 1)
        if period == 2:
            minute = minute + 45
        team_id = ev.get("team", {}).get("id") if isinstance(ev.get("team"), dict) else None
        team_name = ev.get("team", {}).get("name") if isinstance(ev.get("team"), dict) else str(ev.get("team", ""))
        if team_id and team_name:
            team_names[team_id] = team_name
        poss = ev.get("possession_team", {})
        poss_name = poss.get("name") if isinstance(poss, dict) else str(poss) if poss else team_name
        rows.append({
            "minute": int(minute) if minute is not None else 0,
            "second": ev.get("second", 0),
            "period": period,
            "type": ev.get("type", {}).get("name") if isinstance(ev.get("type"), dict) else str(ev.get("type", "")),
            "team": team_name,
            "possession_team": poss_name,
            "player": ev.get("player", {}).get("name") if isinstance(ev.get("player"), dict) else str(ev.get("player", "")),
        })
    if not rows:
        return None
    return pd.DataFrame(rows)


def load_statsbomb_events(match_id: int) -> pd.DataFrame | None:
    """Load events for a match from StatsBomb API (statsbombpy) if available. Used as fallback."""
    try:
        from statsbombpy import sb
        events = sb.events(match_id=match_id)
        if events is None or events.empty:
            return None
        return events
    except Exception:
        return None


def load_matches() -> pd.DataFrame:
    """Load matches: from StatsBomb open data if present, else from processed parquet, else one demo row."""
    df = _load_statsbomb_matches()
    if df is not None and not df.empty:
        return df
    matches_path = os.path.join(PROCESSED_DIR, "matches.parquet")
    if os.path.isfile(matches_path):
        return pd.read_parquet(matches_path)
    return pd.DataFrame([
        {
            "match_id": DEMO_MATCH_ID,
            "competition": "FIFA World Cup",
            "season": "2022",
            "home_team": "France",
            "away_team": "Argentina",
            "home_score": 3,
            "away_score": 3,
            "match_date": "2022-12-18",
            "is_demo_match": True,
        }
    ])


def load_events_for_match(match_id: int) -> pd.DataFrame:
    """Load events for a match. Prefer downloaded StatsBomb JSON, then statsbombpy, then synthetic."""
    events = _load_statsbomb_events(match_id)
    if events is not None and not events.empty:
        return events
    events = load_statsbomb_events(match_id)
    if events is not None and not events.empty:
        return events
    n = 96
    np.random.seed(42)
    return pd.DataFrame({
        "minute": np.arange(n),
        "team": ["France"] * (n // 2) + ["Argentina"] * (n - n // 2),
        "type": ["Pass"] * n,
        "possession_team": ["France"] * 48 + ["Argentina"] * 48,
    })


def load_goals(match_id: int) -> pd.DataFrame:
    """Load goals: from StatsBomb events if available, else from processed parquet, else default demo goals."""
    events = _load_statsbomb_events(match_id)
    if events is not None and not events.empty:
        # StatsBomb: goal events have type "Shot" with shot.outcome.id == 97, or type "Goal"
        goals = []
        for _, ev in events.iterrows():
            if ev.get("type") == "Goal":
                goals.append({
                    "match_id": match_id,
                    "minute": ev.get("minute", 0),
                    "scoring_team": ev.get("team", ""),
                    "conceding_team": "",  # infer from match teams if needed
                })
        if goals:
            return pd.DataFrame(goals)
        # Try raw JSON for shot outcome
        path = os.path.join(STATSBOMB_DIR, "events", f"{match_id}.json")
        if os.path.isfile(path):
            with open(path) as f:
                raw = json.load(f)
            for ev in raw:
                t = ev.get("type") or {}
                name = t.get("name") if isinstance(t, dict) else str(t)
                shot = ev.get("shot") or {}
                outcome = shot.get("outcome") or {}
                out_name = outcome.get("name") if isinstance(outcome, dict) else ""
                if name == "Goal" or (name == "Shot" and out_name == "Goal"):
                    team = ev.get("team") or {}
                    team_name = team.get("name") if isinstance(team, dict) else ""
                    minute = ev.get("minute", 0) or 0
                    period = ev.get("period", 1) or 1
                    if period == 2:
                        minute = int(minute) + 45
                    goals.append({"match_id": match_id, "minute": int(minute), "scoring_team": team_name, "conceding_team": ""})
            if goals:
                return pd.DataFrame(goals)
    path = os.path.join(PROCESSED_DIR, f"goals_{match_id}.parquet")
    if os.path.isfile(path):
        return pd.read_parquet(path)
    return pd.DataFrame([
        {"match_id": match_id, "minute": 23, "scoring_team": "Argentina", "conceding_team": "France"},
        {"match_id": match_id, "minute": 36, "scoring_team": "France", "conceding_team": "Argentina"},
        {"match_id": match_id, "minute": 67, "scoring_team": "Argentina", "conceding_team": "France"},
        {"match_id": match_id, "minute": 80, "scoring_team": "France", "conceding_team": "Argentina"},
        {"match_id": match_id, "minute": 88, "scoring_team": "Argentina", "conceding_team": "France"},
    ])


def load_wc2026_venues() -> pd.DataFrame:
    """Load WC 2026 venue list with lat/lon and environmental stress factors."""
    path = os.path.join(PROCESSED_DIR, "wc2026_venues.parquet")
    if os.path.isfile(path):
        return pd.read_parquet(path)
    return pd.DataFrame([
        {"venue_id": 1, "city": "Mexico City", "country": "Mexico", "lat": 19.43, "lon": -99.13, "elevation_ft": 7349, "june_temp_f": 72, "humidity_pct": 60, "stress_factor": 1.18},
        {"venue_id": 2, "city": "New York/New Jersey", "country": "USA", "lat": 40.71, "lon": -74.01, "elevation_ft": 33, "june_temp_f": 78, "humidity_pct": 65, "stress_factor": 1.02},
        {"venue_id": 3, "city": "Los Angeles", "country": "USA", "lat": 34.05, "lon": -118.24, "elevation_ft": 230, "june_temp_f": 75, "humidity_pct": 55, "stress_factor": 0.98},
        {"venue_id": 4, "city": "Toronto", "country": "Canada", "lat": 43.65, "lon": -79.38, "elevation_ft": 249, "june_temp_f": 72, "humidity_pct": 58, "stress_factor": 0.95},
        {"venue_id": 5, "city": "Miami", "country": "USA", "lat": 25.76, "lon": -80.19, "elevation_ft": 6, "june_temp_f": 88, "humidity_pct": 75, "stress_factor": 1.22},
        {"venue_id": 6, "city": "Dallas", "country": "USA", "lat": 32.78, "lon": -96.80, "elevation_ft": 430, "june_temp_f": 92, "humidity_pct": 45, "stress_factor": 1.08},
        {"venue_id": 7, "city": "Atlanta", "country": "USA", "lat": 33.75, "lon": -84.39, "elevation_ft": 1050, "june_temp_f": 86, "humidity_pct": 68, "stress_factor": 1.06},
        {"venue_id": 8, "city": "Kansas City", "country": "USA", "lat": 39.10, "lon": -94.58, "elevation_ft": 886, "june_temp_f": 82, "humidity_pct": 62, "stress_factor": 1.03},
        {"venue_id": 9, "city": "Houston", "country": "USA", "lat": 29.76, "lon": -95.37, "elevation_ft": 50, "june_temp_f": 90, "humidity_pct": 72, "stress_factor": 1.15},
        {"venue_id": 10, "city": "San Francisco", "country": "USA", "lat": 37.77, "lon": -122.42, "elevation_ft": 52, "june_temp_f": 65, "humidity_pct": 70, "stress_factor": 0.92},
        {"venue_id": 11, "city": "Seattle", "country": "USA", "lat": 47.61, "lon": -122.33, "elevation_ft": 16, "june_temp_f": 68, "humidity_pct": 60, "stress_factor": 0.90},
        {"venue_id": 12, "city": "Vancouver", "country": "Canada", "lat": 49.28, "lon": -123.12, "elevation_ft": 0, "june_temp_f": 66, "humidity_pct": 65, "stress_factor": 0.88},
    ])
