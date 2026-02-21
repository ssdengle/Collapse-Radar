# backend/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "..", "data", "collapseos.duckdb")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import ensure_db_ready
    ensure_db_ready()
    yield


app = FastAPI(title="CollapseOS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    import duckdb
    return duckdb.connect(DB_PATH, read_only=True)


@app.get("/health")
def health():
    return {"status": "ok", "db": "collapseos.duckdb"}


@app.get("/api/matches")
def get_matches():
    db = get_db()
    try:
        rows = db.execute(
            "SELECT match_id, competition, season, home_team, away_team, "
            "home_score, away_score, match_date, is_demo_match FROM matches"
        ).fetchall()
    except Exception:
        return []
    finally:
        db.close()
    cols = ["match_id", "competition", "season", "home_team", "away_team",
            "home_score", "away_score", "match_date", "is_demo_match"]
    return [dict(zip(cols, r)) for r in rows]


@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    db = get_db()
    try:
        match_count = db.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
        demo = db.execute(
            "SELECT match_id, competition, season, home_team, away_team, "
            "home_score, away_score, match_date FROM matches WHERE is_demo_match = true LIMIT 1"
        ).fetchone()
        meta = db.execute("SELECT auc, avg_lead_time, total_warnings FROM model_meta LIMIT 1").fetchone()
    except Exception:
        return {
            "total_matches_analyzed": 0,
            "model_auc": 0.0,
            "avg_lead_time_minutes": 0.0,
            "total_warnings_fired": 0,
            "demo_match": None,
            "last_updated": "2026-02-21",
        }
    finally:
        db.close()
    return {
        "total_matches_analyzed": match_count,
        "model_auc": round(meta[0], 3) if meta else 0.0,
        "avg_lead_time_minutes": round(meta[1], 1) if meta else 0.0,
        "total_warnings_fired": meta[2] if meta else 0,
        "demo_match": {
            "match_id": demo[0], "competition": demo[1], "season": demo[2],
            "home_team": demo[3], "away_team": demo[4],
            "home_score": demo[5], "away_score": demo[6], "match_date": demo[7],
            "is_demo_match": True
        } if demo else None,
        "last_updated": "2026-02-21"
    }


@app.get("/api/match/{match_id}/timeline")
def get_timeline(match_id: int, team: str):
    db = get_db()
    try:
        rows = db.execute(
            "SELECT minute, probability, cusum_flag FROM timelines "
            "WHERE match_id = ? AND team = ? ORDER BY minute",
            [match_id, team]
        ).fetchall()
    finally:
        db.close()
    if not rows:
        raise HTTPException(404, f"No timeline for match {match_id} team {team}")
    return [{"minute": r[0], "probability": r[1], "cusum_flag": bool(r[2])} for r in rows]


@app.get("/api/match/{match_id}/goals")
def get_goals(match_id: int):
    db = get_db()
    try:
        rows = db.execute(
            "SELECT minute, scoring_team, conceding_team FROM goals "
            "WHERE match_id = ? ORDER BY minute",
            [match_id]
        ).fetchall()
    finally:
        db.close()
    return [{"minute": r[0], "scoring_team": r[1], "conceding_team": r[2]} for r in rows]


@app.get("/api/match/{match_id}/window/{minute}")
def get_window(match_id: int, minute: int, team: str):
    db = get_db()
    try:
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
            [match_id, team, minute]
        ).fetchone()
    finally:
        db.close()
    if not row:
        raise HTTPException(404, f"No window data for match {match_id} minute {minute}")
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
        "top_3_drivers": [row[16] or "territory_tilt", row[17] or "turnover_burstiness", row[18] or "defensive_actions_per_min"],
    }


@app.get("/api/match/{match_id}/counterfactual/{minute}")
def get_counterfactual(match_id: int, minute: int, team: str):
    db = get_db()
    try:
        rows = db.execute(
            "SELECT projected_minute, projected_prob FROM counterfactuals "
            "WHERE match_id = ? AND minute = ? AND team = ? ORDER BY projected_minute",
            [match_id, minute, team]
        ).fetchall()
    finally:
        db.close()
    if not rows:
        raise HTTPException(404, "No counterfactual data")
    return [{"projected_minute": r[0], "projected_prob": r[1]} for r in rows]


@app.get("/api/match/{match_id}/network/{minute}")
def get_pass_network(match_id: int, minute: int, team: str):
    db = get_db()
    try:
        nodes = db.execute(
            "SELECT player, centrality, influence_score, fatigue_score, minutes_played "
            "FROM pass_nodes WHERE match_id = ? AND minute = ? "
            "ORDER BY influence_score DESC",
            [match_id, minute]
        ).fetchall()
        edges = db.execute(
            "SELECT from_player, to_player, pass_count FROM pass_edges "
            "WHERE match_id = ? AND minute = ?",
            [match_id, minute]
        ).fetchall()
    finally:
        db.close()
    return {
        "nodes": [
            {"player": r[0], "centrality": r[1], "influence_score": r[2],
             "fatigue_score": r[3], "minutes_played": r[4]}
            for r in nodes
        ],
        "edges": [
            {"from_player": r[0], "to_player": r[1], "pass_count": r[2]}
            for r in edges
        ],
    }


@app.post("/api/match/{match_id}/simulate_removal")
def simulate_removal(match_id: int, body: dict):
    from database import recompute_probability_without_player
    player = body.get("player")
    team = body.get("team")
    minute = body.get("minute", 75)
    if not player or not team:
        raise HTTPException(400, "player and team required")
    try:
        original, new_prob = recompute_probability_without_player(match_id, team, player, minute)
    except Exception as e:
        raise HTTPException(500, str(e))
    return {
        "removed_player": player,
        "original_probability": original,
        "new_probability": new_prob,
        "delta": new_prob - original,
    }


@app.get("/api/wc2026/venues")
def get_wc2026_venues():
    db = get_db()
    try:
        rows = db.execute(
            "SELECT venue_id, city, country, lat, lon, elevation_ft, "
            "june_temp_f, humidity_pct, stress_factor FROM wc2026_venues"
        ).fetchall()
    finally:
        db.close()
    cols = ["venue_id", "city", "country", "lat", "lon", "elevation_ft",
            "june_temp_f", "humidity_pct", "stress_factor"]
    return [dict(zip(cols, r)) for r in rows]


@app.get("/api/wc2026/fixture")
def get_fixture_comparison(team_a: str, team_b: str, venue_city: str):
    db = get_db()
    try:
        venue = db.execute(
            "SELECT venue_id, city, country, lat, lon, elevation_ft, "
            "june_temp_f, humidity_pct, stress_factor "
            "FROM wc2026_venues WHERE city = ?",
            [venue_city]
        ).fetchone()
    finally:
        db.close()
    if not venue:
        raise HTTPException(404, f"Venue {venue_city} not found")
    venue_dict = dict(zip(
        ["venue_id", "city", "country", "lat", "lon", "elevation_ft", "june_temp_f", "humidity_pct", "stress_factor"],
        venue
    ))
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
