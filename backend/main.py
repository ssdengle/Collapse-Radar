# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import duckdb

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

from synthetic_data import (
    synthetic_timeline,
    synthetic_goals,
    synthetic_window,
    synthetic_counterfactual,
    synthetic_network,
)

app = FastAPI(title="CollapseOS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "collapseos.duckdb")


def get_db():
    return duckdb.connect(DB_PATH, read_only=True)


@app.get("/api/matches")
def get_matches():
    db = get_db()
    rows = db.execute(
        "SELECT match_id, competition, season, home_team, away_team, "
        "home_score, away_score, match_date, is_demo_match FROM matches"
    ).fetchall()
    cols = [
        "match_id", "competition", "season", "home_team", "away_team",
        "home_score", "away_score", "match_date", "is_demo_match",
    ]
    return [dict(zip(cols, r)) for r in rows]


@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    db = get_db()
    match_count = db.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
    demo = db.execute(
        "SELECT match_id, competition, season, home_team, away_team, "
        "home_score, away_score, match_date FROM matches WHERE is_demo_match = true LIMIT 1"
    ).fetchone()
    meta = db.execute("SELECT auc, avg_lead_time, total_warnings FROM model_meta LIMIT 1").fetchone()
    return {
        "total_matches_analyzed": match_count,
        "model_auc": round(meta[0], 3) if meta else 0.0,
        "avg_lead_time_minutes": round(meta[1], 1) if meta else 0.0,
        "total_warnings_fired": meta[2] if meta else 0,
        "demo_match": {
            "match_id": demo[0],
            "competition": demo[1],
            "season": demo[2],
            "home_team": demo[3],
            "away_team": demo[4],
            "home_score": demo[5],
            "away_score": demo[6],
            "match_date": demo[7],
            "is_demo_match": True,
        }
        if demo
        else None,
        "last_updated": "2026-02-21",
    }


@app.get("/api/match/{match_id}/stats")
def get_match_stats(match_id: int):
    """Per-match stats for the dashboard cards (matches analyzed=1, model auc, lead time, warnings)."""
    db = get_db()
    # Global model AUC (same for all matches)
    meta = db.execute("SELECT auc, avg_lead_time FROM model_meta LIMIT 1").fetchone()
    model_auc = round(meta[0], 3) if meta else 0.82
    global_lead = round(meta[1], 1) if meta else 8.5

    # Warnings for this match: count recommendations or cusum flags in timelines
    rec_count = db.execute(
        "SELECT COUNT(*) FROM recommendations WHERE match_id = ?", [match_id]
    ).fetchone()[0]
    if rec_count > 0:
        warnings = rec_count
        # Lead time: avg minutes between consecutive recommendation minutes for this match
        lead_rows = db.execute(
            "SELECT minute FROM recommendations WHERE match_id = ? ORDER BY minute", [match_id]
        ).fetchall()
        if len(lead_rows) >= 2:
            gaps = [lead_rows[i + 1][0] - lead_rows[i][0] for i in range(len(lead_rows) - 1)]
            avg_lead = round(sum(gaps) / len(gaps), 1)
        else:
            avg_lead = global_lead
    else:
        cusum_count = db.execute(
            "SELECT COUNT(*) FROM timelines WHERE match_id = ? AND cusum_flag = true",
            [match_id],
        ).fetchone()[0]
        warnings = cusum_count
        avg_lead = global_lead

    # If no data at all, use deterministic synthetic per match_id
    if warnings == 0:
        s = (match_id * 131 + 99) % 1000
        warnings = 3 + (s % 10)
        avg_lead = round(6 + (s % 8) / 2, 1)  # 6–10 min

    return {
        "total_matches_analyzed": 1,
        "model_auc": model_auc,
        "avg_lead_time_minutes": avg_lead,
        "total_warnings_fired": warnings,
    }


@app.get("/api/match/{match_id}/teams")
def get_match_teams(match_id: int):
    """Return list of teams that have timeline data, or [away_team, home_team] from match."""
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT team FROM timelines WHERE match_id = ? ORDER BY team",
        [match_id],
    ).fetchall()
    if rows:
        return [r[0] for r in rows]
    match_row = db.execute(
        "SELECT home_team, away_team FROM matches WHERE match_id = ? LIMIT 1",
        [match_id],
    ).fetchone()
    if match_row:
        return [match_row[1], match_row[0]]  # away, home so defending team first
    return ["Team A", "Team B"]


@app.get("/api/match/{match_id}/timeline")
def get_timeline(match_id: int, team: str):
    db = get_db()
    rows = db.execute(
        "SELECT minute, probability, cusum_flag FROM timelines "
        "WHERE match_id = ? AND team = ? ORDER BY minute",
        [match_id, team],
    ).fetchall()
    if rows:
        return [{"minute": r[0], "probability": r[1], "cusum_flag": bool(r[2])} for r in rows]
    return synthetic_timeline(match_id, team)


@app.get("/api/match/{match_id}/goals")
def get_goals(match_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT minute, scoring_team, conceding_team FROM goals "
        "WHERE match_id = ? ORDER BY minute",
        [match_id],
    ).fetchall()
    if rows:
        return [{"minute": r[0], "scoring_team": r[1], "conceding_team": r[2]} for r in rows]
    return synthetic_goals(match_id)


@app.get("/api/match/{match_id}/window/{minute}")
def get_window(match_id: int, minute: int, team: str):
    db = get_db()
    row = db.execute(
        "SELECT t.minute, t.probability, t.pass_acc_slope, t.turnover_pm, t.burstiness, "
        "t.def_actions_pm, t.ft_entries_pm, t.shots_conc_pm, t.tempo_variance, "
        "t.territory_tilt, t.env_stress, "
        "r.headline, r.rationale_1, r.rationale_2, r.rationale_3, r.risk_delta, "
        "r.driver_1, r.driver_2, r.driver_3 "
        "FROM timelines t "
        "LEFT JOIN recommendations r ON t.match_id = r.match_id "
        "  AND t.minute = r.minute AND t.team = r.team "
        "WHERE t.match_id = ? AND t.team = ? AND t.minute = ?",
        [match_id, team, minute],
    ).fetchone()
    if row:
        return {
            "minute": row[0],
            "probability": row[1],
            "features": {
                "pass_accuracy_slope": row[2],
                "turnover_per_min": row[3],
                "turnover_burstiness": row[4],
                "defensive_actions_per_min": row[5],
                "final_third_entries_per_min": row[6],
                "shots_conceded_per_min": row[7],
                "tempo_variance": row[8],
                "territory_tilt": row[9],
                "env_stress_multiplier": row[10],
            },
            "headline": row[11] or "Monitor defensive shape",
            "rationale": [row[12] or "", row[13] or "", row[14] or ""],
            "risk_delta": row[15] or 0.0,
            "driver_1": row[16] or "territory_tilt",
            "driver_2": row[17] or "turnover_burstiness",
            "driver_3": row[18] or "defensive_actions_per_min",
            "top_3_drivers": [row[16], row[17], row[18]],
        }
    return synthetic_window(match_id, minute, team)


@app.get("/api/match/{match_id}/counterfactual/{minute}")
def get_counterfactual(match_id: int, minute: int, team: str):
    db = get_db()
    rows = db.execute(
        "SELECT projected_minute, projected_prob FROM counterfactuals "
        "WHERE match_id = ? AND minute = ? AND team = ? ORDER BY projected_minute",
        [match_id, minute, team],
    ).fetchall()
    if rows:
        return [{"projected_minute": r[0], "projected_prob": r[1]} for r in rows]
    return synthetic_counterfactual(match_id, minute, team)


@app.get("/api/match/{match_id}/network/{minute}")
def get_pass_network(match_id: int, minute: int, team: str):
    db = get_db()
    nodes = db.execute(
        "SELECT player, centrality, influence_score, fatigue_score, minutes_played "
        "FROM pass_nodes WHERE match_id = ? AND minute = ? "
        "ORDER BY influence_score DESC",
        [match_id, minute],
    ).fetchall()
    edges = db.execute(
        "SELECT from_player, to_player, pass_count FROM pass_edges "
        "WHERE match_id = ? AND minute = ?",
        [match_id, minute],
    ).fetchall()
    if nodes or edges:
        return {
            "nodes": [
                {"player": r[0], "centrality": r[1], "influence_score": r[2], "fatigue_score": r[3], "minutes_played": r[4]}
                for r in nodes
            ],
            "edges": [{"from_player": r[0], "to_player": r[1], "pass_count": r[2]} for r in edges],
        }
    return synthetic_network(match_id, minute, team)


@app.post("/api/match/{match_id}/simulate_removal")
def simulate_removal(match_id: int, body: dict):
    from database import recompute_probability_without_player

    player = body.get("player")
    team = body.get("team")
    minute = body.get("minute", 75)
    if not player or not team:
        raise HTTPException(400, "player and team required")
    original, new_prob = recompute_probability_without_player(match_id, team, player, minute)
    return {
        "removed_player": player,
        "original_probability": original,
        "new_probability": new_prob,
        "delta": new_prob - original,
    }


@app.get("/api/wc2026/venues")
def get_wc2026_venues():
    db = get_db()
    rows = db.execute(
        "SELECT venue_id, city, country, lat, lon, elevation_ft, "
        "june_temp_f, humidity_pct, stress_factor FROM wc2026_venues"
    ).fetchall()
    cols = [
        "venue_id", "city", "country", "lat", "lon", "elevation_ft",
        "june_temp_f", "humidity_pct", "stress_factor",
    ]
    return [dict(zip(cols, r)) for r in rows]


@app.get("/api/wc2026/fixture")
def get_fixture_comparison(team_a: str, team_b: str, venue_city: str):
    db = get_db()
    venue = db.execute(
        "SELECT venue_id, city, country, lat, lon, elevation_ft, "
        "june_temp_f, humidity_pct, stress_factor "
        "FROM wc2026_venues WHERE city = ?",
        [venue_city],
    ).fetchone()
    if not venue:
        raise HTTPException(404, f"Venue {venue_city} not found")
    venue_dict = dict(
        zip(
            [
                "venue_id", "city", "country", "lat", "lon", "elevation_ft",
                "june_temp_f", "humidity_pct", "stress_factor",
            ],
            venue,
        )
    )
    base_prob = 0.22
    adjusted = round(min(base_prob * venue_dict["stress_factor"], 0.85), 3)
    return {
        "team_a": team_a,
        "team_b": team_b,
        "venue": venue_dict,
        "env_stress": venue_dict["stress_factor"],
        "base_probability": base_prob,
        "adjusted_probability": adjusted,
    }


# ─── Coach Mode: Gemini AI suggestions ─────────────────────────────────────

class CoachSuggestionRequest(BaseModel):
    team: str
    minute: int
    risk_percent: float
    headline: str
    rationale: list[str]


def _get_gemini_suggestions(team: str, minute: int, risk_percent: float, headline: str, rationale: list[str]) -> str:
    try:
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return "Set GEMINI_API_KEY in the backend environment to enable AI coach suggestions."
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        rationale_text = "\n".join(f"- {r}" for r in (rationale or [])[:5])
        prompt = f"""You are an expert football (soccer) tactical coach. Based on the following in-match analytics, give the coach 3–4 short, actionable recommendations. Be specific and practical (formations, substitutions, pressing triggers, set-piece reminders). Keep each recommendation to 1–2 sentences.

Context:
- Team in focus: {team}
- Current minute: {minute}
- Collapse risk (probability of conceding in next 10 min): {risk_percent:.0f}%
- Model alert: {headline}
- Suggested interventions from the system:
{rationale_text}

Respond with only the coach recommendations, one per line, no numbering or extra preamble. Start directly with the first recommendation."""
        response = model.generate_content(prompt)
        return (response.text or "").strip()
    except Exception as e:
        return f"Unable to load AI suggestions: {e!s}"


@app.post("/api/coach/suggestions")
def get_coach_suggestions(body: CoachSuggestionRequest):
    """Return Gemini-generated tactical suggestions for the coach based on current risk and rationale."""
    text = _get_gemini_suggestions(
        team=body.team,
        minute=body.minute,
        risk_percent=body.risk_percent,
        headline=body.headline,
        rationale=body.rationale or [],
    )
    return {"suggestions": text}
