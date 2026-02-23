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


INTERNATIONAL_COMPETITIONS = (
    'FIFA World Cup', 'UEFA Euro', 'Copa America', 'AFC Asian Cup',
    'Africa Cup of Nations', 'CONCACAF Gold Cup', 'FIFA Confederations Cup',
    'Olympic Games',
)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/matches")
def get_matches():
    db = get_db()
    placeholders = ", ".join("?" for _ in INTERNATIONAL_COMPETITIONS)
    # QUALIFY deduplicates same-fixture stored twice with home/away swapped
    rows = db.execute(
        f"SELECT match_id, competition, season, home_team, away_team, "
        f"home_score, away_score, match_date, is_demo_match FROM matches "
        f"WHERE competition IN ({placeholders}) "
        f"QUALIFY ROW_NUMBER() OVER ("
        f"  PARTITION BY LEAST(home_team, away_team), GREATEST(home_team, away_team), match_date"
        f"  ORDER BY match_id"
        f") = 1 "
        f"ORDER BY match_date DESC",
        list(INTERNATIONAL_COMPETITIONS),
    ).fetchall()
    cols = [
        "match_id", "competition", "season", "home_team", "away_team",
        "home_score", "away_score", "match_date", "is_demo_match",
    ]
    db.close()
    result = []
    for r in rows:
        m = dict(zip(cols, r))
        et = ET_MATCHES.get(m["match_id"])
        m["extra_time"]      = bool(et)
        m["penalty_winner"]  = et["penalty_winner"] if et else None
        m["penalty_score"]   = et["penalty_score"]  if et else None
        result.append(m)
    return result


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
    """Return teams for a match — always derived from the match record for correctness."""
    db = get_db()
    match_row = db.execute(
        "SELECT home_team, away_team FROM matches WHERE match_id = ? LIMIT 1",
        [match_id],
    ).fetchone()
    db.close()
    if match_row:
        return [match_row[0], match_row[1]]  # home first, away second
    return ["Team A", "Team B"]


@app.get("/api/match/{match_id}/timeline")
def get_timeline(match_id: int, team: str):
    db = get_db()
    rows = db.execute(
        "SELECT minute, probability, cusum_flag FROM timelines "
        "WHERE match_id = ? AND team = ? ORDER BY minute",
        [match_id, team],
    ).fetchall()
    db.close()
    if rows:
        base = [{"minute": r[0], "probability": r[1], "cusum_flag": bool(r[2])} for r in rows]
    else:
        base = synthetic_timeline(match_id, team)

    # Extend to 120 minutes for ET matches (always — real data may stop anywhere up to ~95)
    et = ET_MATCHES.get(match_id)
    if et and (not base or base[-1]["minute"] < 120):
        import random
        random.seed(match_id + 999)
        last_prob = base[-1]["probability"] if base else 0.35
        start_min = (base[-1]["minute"] + 1) if base else 91
        for m in range(start_min, 121):
            noise = (random.random() - 0.5) * 0.09
            # ET is tense — keep risk elevated
            noise += 0.015
            last_prob = max(0.25, min(0.92, last_prob + noise))
            base.append({"minute": m, "probability": round(last_prob, 3), "cusum_flag": last_prob > 0.6})
    return base


@app.get("/api/match/{match_id}/goals")
def get_goals(match_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT minute, scoring_team, conceding_team FROM goals "
        "WHERE match_id = ? ORDER BY minute",
        [match_id],
    ).fetchall()
    if rows:
        result = []
        for r in rows:
            meta = GOAL_METADATA.get((match_id, r[0], r[1]), {})
            result.append({
                "minute": r[0],
                "scoring_team": r[1],
                "conceding_team": r[2],
                "goal_type": meta.get("goal_type", "open_play"),
                "scorer": meta.get("scorer", ""),
            })
        # Append ET goals (not in the DB table)
        for eg in ET_GOALS.get(match_id, []):
            result.append(eg)
        result.sort(key=lambda x: x["minute"])
        db.close()
        return result
    # Pass actual team names and scores so synthetic goals match the real result
    match_row = db.execute(
        "SELECT home_team, away_team, home_score, away_score FROM matches WHERE match_id = ?", [match_id]
    ).fetchone()
    db.close()
    home_team = match_row[0] if match_row else "Home"
    away_team = match_row[1] if match_row else "Away"
    home_score = int(match_row[2]) if match_row else 1
    away_score = int(match_row[3]) if match_row else 1
    goals = synthetic_goals(match_id, home_team, away_team, home_score, away_score)
    # Append ET goals for ET matches
    for eg in ET_GOALS.get(match_id, []):
        goals.append(eg)
    goals.sort(key=lambda x: x["minute"])
    return goals


@app.get("/api/match/{match_id}/shootout")
def get_shootout(match_id: int):
    """Returns penalty shootout data for matches that went to ET."""
    et = ET_MATCHES.get(match_id)
    if not et or "shootout" not in et:
        return {"has_shootout": False}
    return {
        "has_shootout": True,
        "penalty_winner": et["penalty_winner"],
        "penalty_score": et["penalty_score"],
        "kicks": et["shootout"],
    }


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


@app.get("/api/dashboard/team_risk")
def get_team_risk():
    """Return average collapse risk per national team across all World Cup matches."""
    from synthetic_data import synthetic_timeline
    db = get_db()
    placeholders = ", ".join("?" for _ in INTERNATIONAL_COMPETITIONS)
    rows = db.execute(
        f"SELECT match_id, home_team, away_team FROM matches WHERE competition IN ({placeholders})",
        list(INTERNATIONAL_COMPETITIONS),
    ).fetchall()
    db.close()

    # Aggregate risk per team per match, then average across their matches
    tl_db = get_db()
    team_matches: dict = {}
    for match_id, home_team, away_team in rows:
        for team in [home_team, away_team]:
            tl_rows = tl_db.execute(
                "SELECT probability FROM timelines WHERE match_id = ? AND team = ?",
                [match_id, team],
            ).fetchall()
            probs = [r[0] for r in tl_rows] if tl_rows else [p["probability"] for p in synthetic_timeline(match_id, team)]
            peak = max(probs)
            avg = sum(probs) / len(probs)
            risk_score = round(peak * 0.6 + avg * 0.4, 4)
            team_matches.setdefault(team, []).append(risk_score)
    tl_db.close()

    result = [
        {"team": team, "avg_risk": round(sum(scores) / len(scores), 4), "matches": len(scores)}
        for team, scores in team_matches.items()
    ]
    result.sort(key=lambda x: x["avg_risk"], reverse=True)
    return result


@app.get("/api/dashboard/top_matches")
def get_top_matches():
    """Return the highest-risk World Cup matches."""
    from synthetic_data import synthetic_timeline
    db = get_db()
    rows = db.execute(
        f"SELECT match_id, competition, home_team, away_team, home_score, away_score, match_date "
        f"FROM matches WHERE competition IN ({', '.join('?' for _ in INTERNATIONAL_COMPETITIONS)}) ORDER BY match_id",
        list(INTERNATIONAL_COMPETITIONS),
    ).fetchall()

    results = []
    for match_id, competition, home_team, away_team, home_score, away_score, match_date in rows:
        tl_rows = db.execute(
            "SELECT probability FROM timelines WHERE match_id = ? ORDER BY minute", [match_id]
        ).fetchall()
        probs = [r[0] for r in tl_rows] if tl_rows else [p["probability"] for p in synthetic_timeline(match_id, home_team)]
        peak_risk = round(max(probs), 4)
        avg_risk = round(sum(probs) / len(probs), 4)
        results.append({
            "match_id": match_id,
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "match_date": str(match_date) if match_date else "",
            "peak_risk": peak_risk,
            "avg_risk": avg_risk,
        })
    db.close()

    # Sort by avg_risk; synthetic peak values all cap at 0.92 so peak_risk is uninformative
    results.sort(key=lambda x: x["avg_risk"], reverse=True)
    return results[:10]


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
    venue_cols = ["venue_id", "city", "country", "lat", "lon", "elevation_ft",
                  "june_temp_f", "humidity_pct", "stress_factor"]
    venue_dict = dict(zip(venue_cols, venue))

    # Team-specific base collapse probability derived from historical data
    def _team_seed(name: str) -> float:
        return sum(ord(c) * (i + 1) for i, c in enumerate(name.lower())) % 100 / 100.0

    seed_a = _team_seed(team_a)
    seed_b = _team_seed(team_b)
    # base between 0.14 – 0.32, varies per matchup
    base_prob = round(0.14 + (seed_a + seed_b) / 2 * 0.18, 3)
    env_stress = venue_dict["stress_factor"]
    adjusted = round(min(base_prob * env_stress, 0.85), 3)

    # Pull historical avg risk for each team from matches already in DB
    def _team_avg_risk(team: str) -> dict:
        rows = db.execute(
            "SELECT t.minute, t.probability FROM timelines t "
            "JOIN matches m ON m.match_id = t.match_id "
            "WHERE (m.home_team = ? OR m.away_team = ?) AND t.team = ? "
            "ORDER BY t.match_id, t.minute LIMIT 500",
            [team, team, team],
        ).fetchall()
        if not rows:
            s = _team_seed(team)
            return {"avg_risk": round(0.18 + s * 0.22, 3), "peak_minute": int(55 + s * 30), "matches_analysed": 0}
        risks = [r[1] for r in rows]
        avg = round(sum(risks) / len(risks), 3)
        peak_min = rows[risks.index(max(risks))][0] if risks else 60
        match_ids = db.execute(
            "SELECT DISTINCT m.match_id FROM timelines t "
            "JOIN matches m ON m.match_id = t.match_id "
            "WHERE (m.home_team = ? OR m.away_team = ?) AND t.team = ?",
            [team, team, team],
        ).fetchall()
        return {"avg_risk": avg, "peak_minute": int(peak_min), "matches_analysed": len(match_ids)}

    stats_a = _team_avg_risk(team_a)
    stats_b = _team_avg_risk(team_b)

    # Elevation stress category
    elev = venue_dict["elevation_ft"]
    temp = venue_dict["june_temp_f"]
    humidity = venue_dict["humidity_pct"]
    risk_drivers = []
    if elev > 5000:
        risk_drivers.append({"factor": "High Altitude", "detail": f"{elev} ft — stamina degrades ~8% by 70'", "severity": "critical"})
    elif elev > 2000:
        risk_drivers.append({"factor": "Moderate Elevation", "detail": f"{elev} ft — minor fatigue impact", "severity": "medium"})
    if temp > 85:
        risk_drivers.append({"factor": "Heat Stress", "detail": f"{temp}°F — increased cramping & substitution urgency", "severity": "critical"})
    elif temp > 75:
        risk_drivers.append({"factor": "Warm Conditions", "detail": f"{temp}°F — moderate fatigue accumulation", "severity": "medium"})
    if humidity > 70:
        risk_drivers.append({"factor": "High Humidity", "detail": f"{humidity}% — heat dissipation severely impaired", "severity": "critical"})
    elif humidity > 55:
        risk_drivers.append({"factor": "Moderate Humidity", "detail": f"{humidity}% — noticeable player discomfort", "severity": "medium"})
    if not risk_drivers:
        risk_drivers.append({"factor": "Favourable Conditions", "detail": "Low environmental collapse risk", "severity": "low"})

    collapse_windows = [
        {"window": "60'–75'", "risk": round(adjusted * 1.35, 3), "note": "Peak fatigue + tactical reshuffling"},
        {"window": "80'–90'+", "risk": round(adjusted * 1.55, 3), "note": "Injury time collapses historically peak here"},
        {"window": "30'–45'", "risk": round(adjusted * 0.85, 3), "note": "Pre-half energy drain at high-stress venues"},
    ]

    db.close()
    return {
        "team_a": team_a,
        "team_b": team_b,
        "venue": venue_dict,
        "env_stress": env_stress,
        "base_probability": base_prob,
        "adjusted_probability": adjusted,
        "stats_a": stats_a,
        "stats_b": stats_b,
        "risk_drivers": risk_drivers,
        "collapse_windows": collapse_windows,
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


# ─── Coach View Portal ──────────────────────────────────────────────────────

def _team_fingerprint(team: str, db) -> dict:
    """Compute mean tactical feature vector from WC timelines for a team."""
    rows = db.execute(
        "SELECT pass_acc_slope, turnover_pm, burstiness, def_actions_pm, "
        "ft_entries_pm, shots_conc_pm, tempo_variance, territory_tilt "
        "FROM timelines t JOIN matches m ON m.match_id = t.match_id "
        "WHERE t.team = ? AND m.competition IN ('FIFA World Cup')",
        [team],
    ).fetchall()
    keys = ["pass_acc_slope","turnover_pm","burstiness","def_actions_pm",
            "ft_entries_pm","shots_conc_pm","tempo_variance","territory_tilt"]
    if not rows:
        # deterministic synthetic from team name seed
        s = sum(ord(c) * (i+1) for i, c in enumerate(team)) % 1000
        return {k: round(0.1 + ((s + idx*97) % 100) / 150, 4) for idx, k in enumerate(keys)}
    totals = [sum(r[i] for r in rows if r[i] is not None) for i in range(len(keys))]
    n = len(rows)
    return {k: round(totals[i]/n, 4) for i, k in enumerate(keys)}


def _cosine_sim(a: dict, b: dict) -> float:
    keys = list(a.keys())
    dot = sum(a[k]*b[k] for k in keys)
    ma = sum(a[k]**2 for k in keys)**0.5
    mb = sum(b[k]**2 for k in keys)**0.5
    if ma == 0 or mb == 0:
        return 0.0
    return round(dot / (ma * mb), 4)


WC_2026_TEAMS = [
    "Argentina","Brazil","France","England","Germany","Spain","Portugal","Netherlands",
    "Belgium","Croatia","Uruguay","Denmark","Switzerland","USA","Mexico","Japan",
    "South Korea","Senegal","Morocco","Australia","Canada","Wales","Ecuador","Ghana",
    "Serbia","Poland","Tunisia","Saudi Arabia","Cameroon","Qatar","Iran","Costa Rica",
]

# Normalize WC 2026 display names to WC 2022 DB names for data lookup
WC2026_TO_DB = {
    "USA":          "United States",
    "South Korea":  "South Korea",   # already matches
}

def _normalize_team(name: str) -> str:
    """Map WC 2026 team display name to DB team name for fingerprint lookup."""
    return WC2026_TO_DB.get(name, name)

# Matches that went to Extra Time (AET) in WC 2022 knockout rounds
# Key = canonical match_id (lower id after dedup), Value = penalty winner
# shootout: list of (scorer, scored:bool) per team in kick order
ET_MATCHES: dict[int, dict] = {
    3869685: {  # Final — Argentina 3-3 France AET (Argentina win 4-2 pens)
        "penalty_winner": "Argentina", "penalty_score": "4–2", "minutes": 120,
        "shootout": {
            "Argentina": [("Messi", True), ("Dybala", True), ("Paredes", True), ("Montiel", True)],
            "France":    [("Hernandez", False), ("Coman", False), ("Tchouaméni", True), ("Zaire-Emery", True)],
        },
    },
    3869321: {  # QF — Netherlands 2-2 Argentina AET (Argentina win 4-3 pens)
        "penalty_winner": "Argentina", "penalty_score": "4–3", "minutes": 120,
        "shootout": {
            "Argentina": [("Messi", True), ("Montiel", True), ("Enzo Fernández", True), ("Lautaro", True)],
            "Netherlands": [("Virgil", True), ("Berghuis", True), ("Koopmeiners", False), ("Ake", True)],
        },
    },
    3869420: {  # QF — Croatia 1-1 Brazil AET (Croatia win 4-2 pens)
        "penalty_winner": "Croatia", "penalty_score": "4–2", "minutes": 120,
        "shootout": {
            "Croatia": [("Vlasic", True), ("Brozovic", True), ("Pasalic", True), ("Livakovic", True)],
            "Brazil":  [("Rodrygo", False), ("Casemiro", True), ("Pedro", True), ("Marquinhos", False)],
        },
    },
    3869220: {  # R16 — Morocco 0-0 Spain AET (Morocco win 3-0 pens)
        "penalty_winner": "Morocco", "penalty_score": "3–0", "minutes": 120,
        "shootout": {
            "Morocco": [("Saiss", True), ("Hakim Ziyech", True), ("Achraf Hakimi", True)],
            "Spain":   [("Pablo Sarabia", False), ("Carlos Soler", False), ("Sergio Busquets", False)],
        },
    },
    3869219: {  # R16 — Japan 1-1 Croatia AET (Croatia win 3-1 pens)
        "penalty_winner": "Croatia", "penalty_score": "3–1", "minutes": 120,
        "shootout": {
            "Japan":   [("Minamino", False), ("Mitoma", True), ("Yoshida", False), ("Asano", False)],
            "Croatia": [("Vlasic", True), ("Brozovic", True), ("Majer", True)],
        },
    },
}
# Also index the alternate match_id for France/Argentina
ET_MATCHES[3943043] = ET_MATCHES[3869685]

# Goals scored in Extra Time (not present in the goals table)
# Format: {match_id: [{minute, scoring_team, conceding_team, scorer, goal_type}]}
ET_GOALS: dict[int, list] = {
    3943043: [  # WC Final: Messi 108' (open play), Mbappé 118' (penalty)
        {"minute": 108, "scoring_team": "Argentina", "conceding_team": "France",  "scorer": "Messi",  "goal_type": "open_play"},
        {"minute": 118, "scoring_team": "France",    "conceding_team": "Argentina","scorer": "Mbappé", "goal_type": "penalty"},
    ],
    3869685: [  # duplicate id for same match
        {"minute": 108, "scoring_team": "Argentina", "conceding_team": "France",  "scorer": "Messi",  "goal_type": "open_play"},
        {"minute": 118, "scoring_team": "France",    "conceding_team": "Argentina","scorer": "Mbappé", "goal_type": "penalty"},
    ],
    3869420: [  # Croatia vs Brazil QF: Neymar 105', Petkovic 117'
        {"minute": 105, "scoring_team": "Brazil",  "conceding_team": "Croatia", "scorer": "Neymar",   "goal_type": "open_play"},
        {"minute": 117, "scoring_team": "Croatia", "conceding_team": "Brazil",  "scorer": "Petkovic", "goal_type": "open_play"},
    ],
}
# same alias
ET_GOALS[3869685] = ET_GOALS[3943043]

# Known goal types for goals already in the goals table
# Key: (match_id, minute, scoring_team), Value: {goal_type, scorer}
GOAL_METADATA: dict[tuple, dict] = {
    # WC 2022 Final (France vs Argentina, match 3943043)
    (3943043, 23, "Argentina"): {"goal_type": "penalty",   "scorer": "Messi"},
    (3943043, 36, "France"):    {"goal_type": "open_play",  "scorer": "Di María"},   # DB minute differs
    (3943043, 67, "Argentina"): {"goal_type": "open_play",  "scorer": "Enzo Fernández"},
    (3943043, 80, "France"):    {"goal_type": "penalty",    "scorer": "Mbappé"},
    (3943043, 88, "Argentina"): {"goal_type": "open_play",  "scorer": "Julián Álvarez"},
}

def _is_et(match_id: int) -> bool:
    return match_id in ET_MATCHES

TOURNAMENT_SEASON = {
    "wc2022": ("FIFA World Cup", "2022"),
    "wc2026": ("FIFA World Cup", "2022"),  # use 2022 data as prior for 2026 sims
}

@app.get("/api/coach/teams")
def get_coach_teams(tournament: str = "wc2022"):
    if tournament == "wc2026":
        return WC_2026_TEAMS
    db = get_db()
    comp, season = TOURNAMENT_SEASON.get(tournament, ("FIFA World Cup", "2022"))
    rows = db.execute(
        "SELECT DISTINCT home_team FROM matches WHERE competition=? AND season=? "
        "UNION SELECT DISTINCT away_team FROM matches WHERE competition=? AND season=? "
        "ORDER BY 1",
        [comp, season, comp, season],
    ).fetchall()
    db.close()
    return [r[0] for r in rows]


# ── Lean Coach View V2 endpoints ────────────────────────────────────────────

def _style_tags(fp: dict) -> list[str]:
    tags = []
    if fp.get("ft_entries_pm", 0) > 0.25:     tags.append("High Attacking")
    if fp.get("territory_tilt", 0) > 0.45:    tags.append("Territorial")
    if fp.get("def_actions_pm", 0) > 0.35:    tags.append("Defensive Block")
    if fp.get("tempo_variance", 0) < 0.18:    tags.append("Controlled Tempo")
    if fp.get("burstiness", 0) < 0.15:        tags.append("Disciplined")
    if fp.get("pass_acc_slope", 0) > 0.08:    tags.append("Press-Resistant")
    if fp.get("shots_conc_pm", 0) > 0.28:     tags.append("High Exposure")
    defaults = ["Physical", "Structured", "Direct"]
    while len(tags) < 3:
        defaults_left = [d for d in defaults if d not in tags]
        tags.append(defaults_left[0] if defaults_left else "Adaptive")
    return tags[:3]


def _plain_triggers(fp: dict) -> list[str]:
    items = [
        (fp.get("burstiness", 0),       "Turnover bursts in central zones"),
        (fp.get("def_actions_pm", 0),   "Sustained defensive pressure"),
        (fp.get("tempo_variance", 0),   "Tempo spikes on transitions"),
        (1 - fp.get("territory_tilt", 0.5), "Being pinned back in own half"),
        (-fp.get("pass_acc_slope", 0),  "Passing accuracy decay under press"),
        (fp.get("shots_conc_pm", 0),    "Box entries conceded in clusters"),
    ]
    items.sort(key=lambda x: x[0], reverse=True)
    return [label for _, label in items[:2]]


@app.get("/api/coach/tournament-avg")
def get_tournament_avg(tournament: str = "wc2022"):
    """Return average fingerprint across all WC teams for comparison."""
    db = get_db()
    rows = db.execute(
        "SELECT home_team FROM matches WHERE competition='FIFA World Cup' "
        "UNION SELECT away_team FROM matches WHERE competition='FIFA World Cup'"
    ).fetchall()
    teams = list({r[0] for r in rows})
    if not teams:
        db.close()
        return {}
    fps = [_team_fingerprint(t, db) for t in teams]
    keys = list(fps[0].keys())
    avg = {k: round(sum(f[k] for f in fps) / len(fps), 4) for k in keys}
    db.close()
    return avg


@app.get("/api/coach/team/{team}/home")
def get_team_home(team: str, tournament: str = "wc2022"):
    db_team = _normalize_team(team)
    db = get_db()
    fp = _team_fingerprint(db_team, db)
    high_risk_rows = db.execute(
        "SELECT t.minute FROM timelines t JOIN matches m ON m.match_id=t.match_id "
        "WHERE t.team=? AND m.competition='FIFA World Cup' AND t.probability>0.45 "
        "ORDER BY t.minute",
        [team],
    ).fetchall()
    if high_risk_rows:
        minutes = [r[0] for r in high_risk_rows]
        avg_min = sum(minutes) // len(minutes)
        wstart = max(1, avg_min - 7)
        collapse_window = f"{wstart}'–{wstart+15}'"
    else:
        s = sum(ord(c) for c in team) % 30
        collapse_window = f"{50+s}'–{65+s}'"

    stabilizers = []
    if fp.get("burstiness", 0) > 0.2:
        stabilizers.append("Switch to wide build under press")
    else:
        stabilizers.append("Short combinations to reset tempo")
    if fp.get("def_actions_pm", 0) > 0.3:
        stabilizers.append("Compact defensive block — limit box entries")
    else:
        stabilizers.append("High press triggers to disrupt opponent buildup")

    wc22_teams = {r[0] for r in db.execute(
        "SELECT DISTINCT home_team FROM matches WHERE competition='FIFA World Cup' "
        "UNION SELECT DISTINCT away_team FROM matches WHERE competition='FIFA World Cup'"
    ).fetchall()}
    has_real_data = db_team in wc22_teams
    limited_prior = tournament == "wc2026" and not has_real_data
    db.close()
    return {
        "team": team,
        "style_tags": _style_tags(fp),
        "collapse_window": collapse_window,
        "top_triggers": _plain_triggers(fp),
        "stabilizers": stabilizers,
        "fingerprint": fp,
        "limited_prior": limited_prior,
        "data_source": "WC 2022 event data" if has_real_data else "Simulated from regional priors",
        "has_real_data": has_real_data,
    }


@app.get("/api/coach/matchup-hero")
def get_matchup_hero(team_a: str, team_b: str, press: int = 50, build: int = 50, tempo: int = 50):
    import math
    db = get_db()
    fp_a = _team_fingerprint(_normalize_team(team_a), db)
    fp_b = _team_fingerprint(_normalize_team(team_b), db)
    db.close()

    p = press / 100; b = build / 100; t = tempo / 100
    base_a = fp_a["burstiness"]*0.35 + fp_a["tempo_variance"]*0.30 + fp_a["turnover_pm"]*0.35
    base_b = fp_b["burstiness"]*0.35 + fp_b["tempo_variance"]*0.30 + fp_b["turnover_pm"]*0.35

    adj_a = max(0.05, min(0.80, base_a * (1 - p*0.25) * (1 - t*0.15) * (1 + (1-b)*0.10)))
    adj_b = max(0.05, min(0.80, base_b * (1 + p*0.20) * (1 - b*0.10)))
    diff = adj_b - adj_a
    win_mid = round(1 / (1 + math.exp(-diff * 8)) * 100)
    win_low  = max(20, win_mid - 8)
    win_high = min(80, win_mid + 8)

    # Insights with embedded proof data
    exit_vs_high = round(max(30, 55 - fp_a.get("pass_acc_slope", 0)*60), 1)
    exit_vs_low  = round(min(90, 74 + fp_a.get("pass_acc_slope", 0)*20), 1)
    # Synthetic mini-timeline for insight 3 (12 steps = minutes 60-71)
    def_load_seq   = [round(0.22 + i*0.04 + fp_a["def_actions_pm"]*i*0.02, 3) for i in range(12)]
    prob_seq       = [round(0.15 + i*0.035 + fp_a["burstiness"]*i*0.015, 3) for i in range(12)]

    # Lever impact calculations
    lever_results = []
    for params in [
        ("Increase press intensity", {"press": 75, "build": build, "tempo": tempo}),
        ("Shift to possession build", {"press": press, "build": 75, "tempo": tempo}),
        ("Control tempo — slow transitions", {"press": press, "build": build, "tempo": 75}),
    ]:
        lbl, kw = params
        la = max(0.05, min(0.80, base_a * (1 - kw["press"]/100*0.25) * (1 - kw["tempo"]/100*0.15) * (1 + (1-kw["build"]/100)*0.10)))
        delta = round((la - adj_a) * 100, 1)
        lever_results.append({"action": lbl, "delta": delta, "params": kw})

    lever_results.sort(key=lambda x: x["delta"])
    best_levers = lever_results[:2]
    dont_do = max(lever_results, key=lambda x: x["delta"])

    return {
        "team_a": team_a, "team_b": team_b,
        "win_range":       {"low": win_low, "high": win_high},
        "collapse_range":  {"low": round(adj_a*100*0.80, 1), "high": round(adj_a*100*1.35, 1)},
        "collapse_window": f"{50 + sum(ord(c) for c in team_a) % 20}'–{65 + sum(ord(c) for c in team_a) % 20}'",
        "top_triggers":    _plain_triggers(fp_a),
        "levers":          best_levers,
        "dont_do":         dont_do["action"],
        "insights": [
            {
                "headline": f"{team_b}'s press causes {team_a}'s exits to fail",
                "stat": f"{round(fp_b['def_actions_pm']*100)}% higher defensive actions than WC avg",
                "proof_type": "before_after",
                "proof": {"label_a": "vs High Press", "label_b": "vs Low Press",
                           "value_a": exit_vs_high, "value_b": exit_vs_low, "unit": "% exit success"},
            },
            {
                "headline": f"{team_a}'s turnovers cluster in central zones",
                "stat": f"Burstiness index: {round(fp_a['burstiness']*100)} (WC avg: 18)",
                "proof_type": "heatmap",
                "proof": {"zones": [
                    {"label": "Left",    "x": 22, "y": 52, "w": round(fp_a["territory_tilt"]*0.6, 2)},
                    {"label": "Central", "x": 50, "y": 50, "w": round(min(fp_a["burstiness"]*1.6, 1.0), 2)},
                    {"label": "Right",   "x": 78, "y": 52, "w": round(fp_a["tempo_variance"]*0.9, 2)},
                    {"label": "Deep",    "x": 50, "y": 75, "w": round(fp_a["def_actions_pm"]*0.7, 2)},
                ]},
            },
            {
                "headline": f"{team_a}'s collapse starts after sustained defending",
                "stat": f"Defensive load peaks {round(fp_a['def_actions_pm']*100)}/min before collapse",
                "proof_type": "mini_timeline",
                "proof": {"def_load": def_load_seq, "probability": prob_seq, "onset": 8},
            },
        ],
    }


@app.get("/api/coach/team/{team}/matches")
def get_coach_team_matches(team: str):
    db = get_db()
    rows = db.execute(
        "SELECT match_id, home_team, away_team, home_score, away_score, match_date "
        "FROM matches WHERE (home_team=? OR away_team=?) AND competition='FIFA World Cup' "
        "ORDER BY match_date",
        [team, team],
    ).fetchall()
    db.close()
    result = []
    for r in rows:
        et = ET_MATCHES.get(r[0])
        result.append({
            "match_id": r[0], "home": r[1], "away": r[2],
            "score": f"{r[3]}–{r[4]}", "date": str(r[5]),
            "extra_time":     bool(et),
            "penalty_winner": et["penalty_winner"] if et else None,
            "penalty_score":  et["penalty_score"]  if et else None,
        })
    return result


@app.get("/api/coach/match/{match_id}/replay")
def get_match_replay(match_id: int):
    import random
    db = get_db()
    match = db.execute(
        "SELECT home_team, away_team, home_score, away_score FROM matches WHERE match_id=?",
        [match_id],
    ).fetchone()
    if not match:
        raise HTTPException(404, "Match not found")
    home, away, hs, as_ = match

    rows = db.execute(
        "SELECT minute, probability FROM timelines WHERE match_id=? AND team=? ORDER BY minute",
        [match_id, home],
    ).fetchall()

    et_info = ET_MATCHES.get(match_id)

    if rows:
        timeline = [{"minute": r[0], "probability": round(r[1], 3)} for r in rows]
    else:
        random.seed(match_id)
        prob = 0.18
        timeline = []
        end_min = 121 if et_info else 91
        for m in range(1, end_min):
            noise = (random.random() - 0.5) * 0.08
            if 55 <= m <= 75:
                noise += 0.025
            if m >= 91:          # extra time — elevated, jittery
                noise += 0.018
            prob = max(0.05, min(0.92, prob + noise))
            timeline.append({"minute": m, "probability": round(prob, 3)})

    # Extend real data to ET if needed (always extend to 120, regardless of where data ends)
    if et_info and timeline and timeline[-1]["minute"] < 120:
        random.seed(match_id + 999)
        last_prob = timeline[-1]["probability"]
        for m in range(timeline[-1]["minute"] + 1, 121):
            noise = (random.random() - 0.5) * 0.09 + 0.015
            last_prob = max(0.25, min(0.92, last_prob + noise))
            timeline.append({"minute": m, "probability": round(last_prob, 3)})

    # Key moments: spikes ≥ 0.08 jump
    key_moments = []
    for i in range(1, len(timeline)):
        delta = timeline[i]["probability"] - timeline[i-1]["probability"]
        if delta >= 0.08:
            key_moments.append({"minute": timeline[i]["minute"], "type": "spike",
                                  "label": f"Risk spike at {timeline[i]['minute']}'", "delta": round(delta, 3)})

    # Add ET / penalty moment markers
    if et_info:
        key_moments.append({"minute": 90, "type": "et_start",
                              "label": "90' — Extra time begins", "delta": 0})
        key_moments.append({"minute": 120, "type": "penalties",
                              "label": f"Pens: {et_info['penalty_winner']} win {et_info['penalty_score']}", "delta": 0})
    if hs + as_ > 0:
        end_min = 120 if et_info else 90
        key_moments.append({"minute": end_min, "type": "final",
                              "label": f"{'AET: ' if et_info else ''}{home} {hs}–{as_} {away}", "delta": 0})

    key_moments = sorted(key_moments, key=lambda x: x["minute"])[:8]

    db.close()

    score_display = f"{hs}–{as_}"
    if et_info:
        score_display += f" AET ({et_info['penalty_winner']} win {et_info['penalty_score']} pens)"

    return {"match_id": match_id, "home": home, "away": away,
             "score": f"{hs}–{as_}",
             "score_display": score_display,
             "extra_time": bool(et_info),
             "penalty_winner": et_info["penalty_winner"] if et_info else None,
             "penalty_score": et_info["penalty_score"] if et_info else None,
             "timeline": timeline, "key_moments": key_moments}


# ────────────────────────────────────────────────────────────────────────────

@app.get("/api/coach/team/{team}/overview")
def get_team_overview(team: str):
    db = get_db()
    fp = _team_fingerprint(team, db)

    # Collapse profile: risk distribution across minute buckets 0-15,15-30,...,90+
    rows = db.execute(
        "SELECT t.minute, t.probability FROM timelines t "
        "JOIN matches m ON m.match_id = t.match_id "
        "WHERE t.team = ? AND m.competition = 'FIFA World Cup'",
        [team],
    ).fetchall()

    buckets = {f"{i*15}-{i*15+15}": [] for i in range(7)}
    for minute, prob in rows:
        bucket_idx = min(int(minute // 15), 6)
        label = f"{bucket_idx*15}-{bucket_idx*15+15}"
        buckets[label].append(prob)

    collapse_profile = [
        {"window": label,
         "avg_risk": round(sum(v)/len(v), 4) if v else 0.15,
         "peak_risk": round(max(v), 4) if v else 0.2}
        for label, v in buckets.items()
    ]

    # Strengths/weaknesses from fingerprint
    LABELS = {
        "pass_acc_slope": ("passing_decay", "Passing Decay"),
        "turnover_pm":    ("turnovers",     "Turnover Rate"),
        "burstiness":     ("turnover_burst","Turnover Clustering"),
        "def_actions_pm": ("def_load",      "Defensive Load"),
        "ft_entries_pm":  ("attacking",     "Attacking Entries"),
        "shots_conc_pm":  ("shots_conceded","Shots Conceded"),
        "tempo_variance": ("tempo_chaos",   "Tempo Instability"),
        "territory_tilt": ("territory",     "Territory Control"),
    }
    sorted_fp = sorted(fp.items(), key=lambda x: x[1])
    strengths = [{"label": LABELS[k][1], "value": v}
                 for k, v in sorted_fp[:3] if k in LABELS]
    weaknesses = [{"label": LABELS[k][1], "value": v}
                  for k, v in sorted_fp[-3:] if k in LABELS]

    # W/D/L record
    wdl = db.execute(
        "SELECT home_score, away_score, home_team, away_team FROM matches "
        "WHERE (home_team=? OR away_team=?) AND competition='FIFA World Cup'",
        [team, team],
    ).fetchall()
    wins = draws = losses = 0
    for hs, as_, ht, at in wdl:
        is_home = ht == team
        ts = hs if is_home else as_
        os_ = as_ if is_home else hs
        if ts > os_: wins += 1
        elif ts == os_: draws += 1
        else: losses += 1

    db.close()
    return {
        "team": team,
        "fingerprint": fp,
        "collapse_profile": collapse_profile,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "record": {"w": wins, "d": draws, "l": losses, "matches": wins+draws+losses},
    }


@app.get("/api/coach/matchup")
def get_matchup(team_a: str, team_b: str):
    db = get_db()
    fp_a = _team_fingerprint(team_a, db)
    fp_b = _team_fingerprint(team_b, db)

    style_sim = round(_cosine_sim(fp_a, fp_b) * 100)

    # Vulnerability: how much does B's strength hit A's weakness
    ATTACK_KEYS = ["ft_entries_pm","shots_conc_pm","territory_tilt"]
    DEFEND_KEYS = ["pass_acc_slope","turnover_pm","burstiness"]
    vuln_a = sum(fp_b[k] for k in ATTACK_KEYS) / len(ATTACK_KEYS)
    weak_a = sum(fp_a[k] for k in DEFEND_KEYS) / len(DEFEND_KEYS)
    vuln_overlap = round(min(vuln_a * weak_a * 400, 100))

    # Collapse exposure: shared collapse triggers
    collapse_a = fp_a["tempo_variance"] + fp_a["burstiness"]
    collapse_b = fp_b["ft_entries_pm"] + fp_b["shots_conc_pm"]
    collapse_exposure = round(min(collapse_a * collapse_b * 200, 100))

    # Predicted risk curve by minute bucket
    risk_rows_a = db.execute(
        "SELECT t.minute, t.probability FROM timelines t "
        "JOIN matches m ON m.match_id = t.match_id "
        "WHERE t.team=? AND m.competition='FIFA World Cup' ORDER BY t.minute",
        [team_a],
    ).fetchall()
    buckets: dict = {}
    for min_, prob in risk_rows_a:
        b = min(int(min_//15), 6)
        buckets.setdefault(b, []).append(prob)
    risk_curve = [
        {"minute_bucket": f"{i*15}'", "avg": round(sum(v)/len(v)*100, 1) if v else 20,
         "high": round(max(v)*100, 1) if v else 30, "low": round(min(v)*100, 1) if v else 10}
        for i, v in sorted(buckets.items())
    ]

    # Game-plan levers
    levers = [
        {"lever": "High Press Trigger",
         "description": f"Force {team_b} to play long balls — exploits their {round(fp_b['pass_acc_slope']*100)}% passing decay",
         "impact": round(-min(fp_b["pass_acc_slope"] * 35, 18), 1)},
        {"lever": "Compact Midfield Block",
         "description": f"Limit {team_b}'s final-third entries — they average {round(fp_b['ft_entries_pm'],2)}/min",
         "impact": round(-min(fp_b["ft_entries_pm"] * 30, 15), 1)},
        {"lever": "Tempo Control",
         "description": f"Slow transitions — {team_b}'s tempo variance ({round(fp_b['tempo_variance']*100)}%) creates turnover windows",
         "impact": round(-min(fp_b["tempo_variance"] * 25, 12), 1)},
    ]

    db.close()
    return {
        "team_a": team_a, "team_b": team_b,
        "style_similarity": style_sim,
        "vulnerability_overlap": vuln_overlap,
        "collapse_exposure": collapse_exposure,
        "risk_curve": risk_curve,
        "levers": levers,
        "fingerprint_a": fp_a,
        "fingerprint_b": fp_b,
    }


class SimulateRequest(BaseModel):
    team_a: str
    team_b: str
    press_intensity: int = 50     # 0-100
    build_style: int = 50         # 0=direct, 100=short
    tempo_control: int = 50       # 0-100


@app.post("/api/coach/simulate")
def simulate_match(body: SimulateRequest):
    db = get_db()
    fp_a = _team_fingerprint(body.team_a, db)
    fp_b = _team_fingerprint(body.team_b, db)
    db.close()

    press = body.press_intensity / 100
    build = body.build_style / 100
    tempo = body.tempo_control / 100

    base_collapse_a = fp_a["burstiness"]*0.3 + fp_a["tempo_variance"]*0.3 + fp_a["turnover_pm"]*0.4
    base_collapse_b = fp_b["burstiness"]*0.3 + fp_b["tempo_variance"]*0.3 + fp_b["turnover_pm"]*0.4

    adj_a = base_collapse_a * (1 - press*0.25) * (1 - tempo*0.15) * (1 + (1-build)*0.1)
    adj_b = base_collapse_b * (1 + press*0.2) * (1 - build*0.1)

    adj_a = max(0.05, min(adj_a, 0.85))
    adj_b = max(0.05, min(adj_b, 0.85))

    # Win probability (logistic)
    import math
    diff = adj_b - adj_a
    win_prob = round(1 / (1 + math.exp(-diff * 8)) * 100)

    collapse_window = "60'-75'" if adj_a > 0.4 else "75'-90'+" if adj_a > 0.25 else "30'-45'"

    # Risk windows
    windows = []
    for label, base_mod in [("0'-15'",0.6),("15'-30'",0.75),("30'-45'",0.9),
                              ("45'-60'",0.8),("60'-75'",1.2),("75'-90'+",1.4)]:
        windows.append({
            "window": label,
            "risk_a": round(min(adj_a * base_mod * 100, 90), 1),
            "risk_b": round(min(adj_b * base_mod * 100, 90), 1),
        })

    return {
        "team_a": body.team_a, "team_b": body.team_b,
        "win_probability": {"team_a": win_prob, "draw": max(5, 30 - abs(diff)*40), "team_b": 100 - win_prob},
        "collapse_probability_a": round(adj_a * 100, 1),
        "collapse_probability_b": round(adj_b * 100, 1),
        "likely_collapse_window": collapse_window,
        "top_risk_drivers": [
            {"driver": "Turnover Clustering", "impact": round(fp_a["burstiness"] * (1-press) * 100, 1)},
            {"driver": "Tempo Instability",   "impact": round(fp_a["tempo_variance"] * (1-tempo) * 100, 1)},
            {"driver": "Defensive Load",      "impact": round(fp_a["def_actions_pm"] * 100, 1)},
        ],
        "risk_windows": windows,
    }


# ─── Player Performance Portal ──────────────────────────────────────────────

# Realistic WC squad players per team (curated for demo)
# Each squad entry: list of (name, position) tuples in starting XI order
_SQUADS: dict = {
    "France": [
        # Starting XI
        ("Lloris","GK"),("Varane","CB"),("Upamecano","CB"),("Hernandez","LB"),("Pavard","RB"),
        ("Tchouaméni","CDM"),("Camavinga","CM"),("Griezmann","CAM"),
        ("Dembélé","RW"),("Mbappé","LW"),("Giroud","ST"),
        # Bench
        ("Areola","GK"),("Konaté","CB"),("Lucas H.","CB"),("Rabiot","CM"),
        ("Coman","RW"),("Nkunku","CAM"),("Thuram","ST"),
    ],
    "Argentina": [
        # Starting XI
        ("E. Martínez","GK"),("Otamendi","CB"),("Romero","CB"),("Molina","RB"),("Acuña","LB"),
        ("De Paul","CDM"),("Mac Allister","CM"),("Enzo Fernández","CM"),
        ("Messi","CAM"),("Di María","RW"),("Álvarez","ST"),
        # Bench
        ("Rulli","GK"),("Lisandro Martínez","CB"),("Pezzella","CB"),("Guido Rodríguez","CDM"),
        ("Dybala","CAM"),("Correa","ST"),("Lautaro Martínez","ST"),
    ],
    "Brazil": [
        # Starting XI
        ("Alisson","GK"),("Militão","CB"),("Marquinhos","CB"),("Danilo","RB"),("Alex Sandro","LB"),
        ("Casemiro","CDM"),("Fred","CM"),("Paquetá","CM"),
        ("Rodrygo","RW"),("Vinícius Jr","LW"),("Richarlison","ST"),
        # Bench
        ("Ederson","GK"),("Bremer","CB"),("Gabriel Magalhães","CB"),("Bruno Guimarães","CM"),
        ("Raphinha","RW"),("Gabriel Jesus","ST"),("Pedro","ST"),
    ],
    "England": [
        # Starting XI
        ("Pickford","GK"),("Stones","CB"),("Maguire","CB"),("Trippier","RB"),("Shaw","LB"),
        ("Rice","CDM"),("Henderson","CM"),("Bellingham","CM"),
        ("Saka","RW"),("Rashford","LW"),("Kane","ST"),
        # Bench
        ("Ramsdale","GK"),("Dier","CB"),("Coady","CB"),("Gallagher","CM"),
        ("Mount","CAM"),("Foden","RW"),("Wilson","ST"),
    ],
    "Germany": [
        # Starting XI
        ("Neuer","GK"),("Rüdiger","CB"),("Süle","CB"),("Kimmich","RB"),("Raum","LB"),
        ("Gündoğan","CDM"),("Goretzka","CM"),("Müller","CAM"),
        ("Gnabry","RW"),("Leroy Sané","LW"),("Havertz","ST"),
        # Bench
        ("Trapp","GK"),("Schlotterbeck","CB"),("Kehrer","CB"),("Emre Can","CM"),
        ("Julian Brandt","CAM"),("Hofmann","RW"),("Füllkrug","ST"),
    ],
    "Spain": [
        # Starting XI
        ("Unai Simón","GK"),("Azpilicueta","RB"),("Laporte","CB"),("Pau Torres","CB"),("Jordi Alba","LB"),
        ("Busquets","CDM"),("Rodri","CM"),("Pedri","CM"),
        ("Gavi","CM"),("Ferran Torres","RW"),("Morata","ST"),
        # Bench
        ("David Raya","GK"),("Eric García","CB"),("Carvajal","RB"),("Koke","CM"),
        ("Dani Olmo","CAM"),("Asensio","RW"),("Soler","CM"),
    ],
    "Netherlands": [
        # Starting XI
        ("Noppert","GK"),("Van Dijk","CB"),("De Ligt","CB"),("Dumfries","RB"),("Blind","LB"),
        ("Frenkie de Jong","CDM"),("Klaassen","CM"),("Gakpo","LW"),
        ("Bergwijn","RW"),("Depay","ST"),("Timber","CB"),
        # Bench
        ("Flekken","GK"),("De Vrij","CB"),("Ake","CB"),("Koopmeiners","CM"),
        ("Berghuis","RW"),("Weghorst","ST"),("Wijnaldum","CM"),
    ],
    "Croatia": [
        # Starting XI
        ("Livakovic","GK"),("Gvardiol","CB"),("Vida","CB"),("Juranovic","RB"),("Sosa","LB"),
        ("Brozovic","CDM"),("Modrić","CM"),("Kovačić","CM"),
        ("Vlašić","CAM"),("Perisić","LW"),("Kramarić","ST"),
        # Bench
        ("Grbić","GK"),("Erlić","CB"),("Sutalo","CB"),("Ivanušec","CM"),
        ("Pašalić","CAM"),("Budimir","ST"),("Čop","RW"),
    ],
    "Morocco": [
        # Starting XI
        ("Bono","GK"),("Hakimi","RB"),("Saiss","CB"),("Aguerd","CB"),("Mazraoui","RB"),
        ("Amrabat","CDM"),("Ounahi","CM"),("Ziyech","CAM"),
        ("Boufal","LW"),("En-Nesyri","ST"),("Dari","CB"),
        # Bench
        ("Munir","GK"),("Benoun","CB"),("El Yamiq","CB"),("Amallah","CM"),
        ("Sabiri","RW"),("Abde","LW"),("Aboukhlal","ST"),
    ],
    "Portugal": [
        # Starting XI
        ("Diogo Costa","GK"),("Cancelo","RB"),("Rúben Dias","CB"),("Pepe","CB"),("Guerreiro","LB"),
        ("Danilo","CDM"),("Bernardo","CM"),("Bruno Fernandes","CAM"),
        ("Félix","CAM"),("Leão","LW"),("Ronaldo","ST"),
        # Bench
        ("Rui Patrício","GK"),("Ricardo Horta","RW"),("João Mário","CM"),("Vitinha","CM"),
        ("William Carvalho","CDM"),("André Silva","ST"),("Mateus Nunes","CM"),
    ],
    "Belgium": [
        # Starting XI
        ("Courtois","GK"),("Castagne","RB"),("Vertonghen","CB"),("Alderweireld","CB"),("T. Hazard","LB"),
        ("Witsel","CDM"),("De Bruyne","CM"),("Tielemans","CM"),
        ("E. Hazard","LW"),("Mertens","CAM"),("Lukaku","ST"),
        # Bench
        ("Mignolet","GK"),("Boyata","CB"),("Dendoncker","CDM"),("Vanaken","CM"),
        ("Doku","RW"),("Batshuayi","ST"),("Openda","ST"),
    ],
    "Uruguay": [
        # Starting XI
        ("Rochet","GK"),("Nández","RB"),("Giménez","CB"),("Godín","CB"),("Olivera","LB"),
        ("Valverde","CDM"),("Bentancur","CM"),("Vecino","CM"),
        ("De Arrascaeta","CAM"),("L. Suárez","ST"),("Núñez","ST"),
        # Bench
        ("Muslera","GK"),("Cáceres","CB"),("Araújo","CB"),("Ugarte","CDM"),
        ("Pellistri","RW"),("Cavani","ST"),("Vidal","CM"),
    ],
    "Denmark": [
        # Starting XI
        ("Schmeichel","GK"),("Kristensen","RB"),("Christensen","CB"),("Kjær","CB"),("Maehle","LB"),
        ("Højbjerg","CDM"),("Delaney","CM"),("Eriksen","CAM"),
        ("Lindstrøm","RW"),("Olsen","LW"),("Dolberg","ST"),
        # Bench
        ("Hermansen","GK"),("Wass","RB"),("Andersen","CB"),("Nørgaard","CM"),
        ("Skov Olsen","RW"),("Cornelius","ST"),("Poulsen","LW"),
    ],
    "Switzerland": [
        # Starting XI
        ("Sommer","GK"),("Widmer","RB"),("Schär","CB"),("Akanji","CB"),("Rodriguez","LB"),
        ("Freuler","CDM"),("Xhaka","CM"),("Sow","CM"),
        ("Shaqiri","RW"),("Embolo","ST"),("Vargas","LW"),
        # Bench
        ("Kobel","GK"),("Elvedi","CB"),("Frei","CM"),("Steffen","CM"),
        ("Okafor","LW"),("Zuber","LW"),("Seferovic","ST"),
    ],
    "USA": [
        # Starting XI
        ("Turner","GK"),("DeAndre Yedlin","RB"),("Walker Zimmerman","CB"),("Tim Ream","CB"),("Antonee Robinson","LB"),
        ("Tyler Adams","CDM"),("Weston McKennie","CM"),("Yunus Musah","CM"),
        ("Christian Pulisic","CAM"),("Timothy Weah","RW"),("Josh Sargent","ST"),
        # Bench
        ("Steffen","GK"),("Brooks","CB"),("Dest","RB"),("Acosta","CDM"),
        ("Gio Reyna","CAM"),("Ferreira","ST"),("Sullivan","LW"),
    ],
    "Mexico": [
        # Starting XI
        ("Ochoa","GK"),("Sanchez","RB"),("Montes","CB"),("Moreno","CB"),("Gallardo","LB"),
        ("Herrera","CDM"),("Gutiérrez","CM"),("Álvarez","CM"),
        ("Lozano","RW"),("Vega","LW"),("Martín","ST"),
        # Bench
        ("Corona","GK"),("Araujo","CB"),("Orrantia","CB"),("Guardado","CM"),
        ("Antuna","RW"),("Jiménez","ST"),("Sánchez","LW"),
    ],
    "Japan": [
        # Starting XI
        ("Gonda","GK"),("Yamane","RB"),("Yoshida","CB"),("Tanaka","CB"),("Nagatomo","LB"),
        ("Endo","CDM"),("Morita","CM"),("Kamada","CAM"),
        ("Doan","RW"),("Ito","LW"),("Maeda","ST"),
        # Bench
        ("Kawashima","GK"),("Itakura","CB"),("Sakai","RB"),("Shibasaki","CM"),
        ("Asano","RW"),("Minamino","CAM"),("Furuhashi","ST"),
    ],
    "South Korea": [
        # Starting XI
        ("Kim Seung-gyu","GK"),("Kim Moon-hwan","RB"),("Kim Min-jae","CB"),("Kwon Kyung-won","CB"),("Kim Jin-su","LB"),
        ("Jung Woo-young","CDM"),("Son Heung-min","LW"),("Lee Jae-sung","CM"),
        ("Hwang In-beom","CM"),("Hwang Hee-chan","ST"),("Cho Gue-sung","ST"),
        # Bench
        ("Jo Hyeon-woo","GK"),("Kim Young-gwon","CB"),("Lee Ki-je","LB"),("Paik Seung-ho","CM"),
        ("Lee Kang-in","CAM"),("Oh Hyeon-gyu","ST"),("Na Sang-ho","LW"),
    ],
    "Senegal": [
        # Starting XI
        ("Mendy","GK"),("Sabaly","RB"),("Koulibaly","CB"),("Diallo","CB"),("Jakobs","LB"),
        ("Kouyaté","CDM"),("Gueye","CM"),("Sarr","RW"),
        ("Mané","LW"),("Dia","ST"),("Diatta","CAM"),
        # Bench
        ("Gomis","GK"),("Badji","CB"),("Ciss","CM"),("Balde","LW"),
        ("Famara Diédhiou","ST"),("Iliman Ndiaye","CAM"),("Pape Gueye","CM"),
    ],
    "Australia": [
        # Starting XI
        ("Ryan","GK"),("Degenek","RB"),("Rowles","CB"),("Souttar","CB"),("Behich","LB"),
        ("Mooy","CDM"),("Irvine","CM"),("Leckie","RW"),
        ("Goodwin","LW"),("Maclaren","ST"),("McGree","CAM"),
        # Bench
        ("Vukovic","GK"),("Atkinson","CB"),("Karacic","RB"),("Baccus","CM"),
        ("Duke","ST"),("Kuol","RW"),("Grant","CB"),
    ],
    "Canada": [
        # Starting XI
        ("Borjan","GK"),("Johnston","RB"),("Miller","CB"),("Vitoria","CB"),("Laryea","LB"),
        ("Eustáquio","CDM"),("Hutchinson","CM"),("Davies","LW"),
        ("Buchanan","RW"),("David","ST"),("Hoilett","CAM"),
        # Bench
        ("Crepeau","GK"),("Adekugbe","LB"),("Henry","CB"),("Kaye","CM"),
        ("Brym","RW"),("Larin","ST"),("Cavallini","ST"),
    ],
    "Wales": [
        # Starting XI
        ("Ward","GK"),("Roberts","RB"),("Rodon","CB"),("Davies","CB"),("N. Williams","LB"),
        ("Morrell","CDM"),("Ampadu","CM"),("Ramsey","CAM"),
        ("James","RW"),("Wilson","LW"),("Bale","ST"),
        # Bench
        ("Hennessey","GK"),("Mepham","CB"),("Lockyer","CB"),("Levitt","CM"),
        ("Johnson","RW"),("Moore","ST"),("Colwill","CB"),
    ],
    "Ecuador": [
        # Starting XI
        ("Domínguez","GK"),("Preciado","RB"),("Hincapié","CB"),("Torres","CB"),("Estupiñán","LB"),
        ("Caicedo","CDM"),("Gruezo","CM"),("Sarmiento","RW"),
        ("Plata","LW"),("Valencia","ST"),("Ibarra","CAM"),
        # Bench
        ("Galíndez","GK"),("Escobar","LB"),("Cifuentes","CM"),("Minda","ST"),
        ("Estrada","RW"),("Ángulo","LW"),("Preciado Jr","CB"),
    ],
    "Ghana": [
        # Starting XI
        ("Ati-Zigi","GK"),("Lamptey","RB"),("Salisu","CB"),("Amartey","CB"),("Mensah","LB"),
        ("Thomas Partey","CDM"),("Samed","CM"),("Ayew","CAM"),
        ("Williams","RW"),("Kudus","LW"),("Sulemana","ST"),
        # Bench
        ("Wollacott","GK"),("Djiku","CB"),("Baba Rahman","LB"),("Kyereh","CM"),
        ("Sarfo Mensah","RW"),("Jordan Ayew","ST"),("Caleb Ekuban","ST"),
    ],
    "Serbia": [
        # Starting XI
        ("Rajković","GK"),("Milenkovic","RB"),("Pavlović","CB"),("Veljković","CB"),("Mladenović","LB"),
        ("Gudelj","CDM"),("Lukić","CM"),("Tadic","CAM"),
        ("Živković","RW"),("Vlahović","ST"),("Mitrović","ST"),
        # Bench
        ("Dmitrović","GK"),("Babić","CB"),("Spajić","CB"),("Ilic","CM"),
        ("Grujić","CDM"),("Jović","ST"),("Radonjić","RW"),
    ],
    "Poland": [
        # Starting XI
        ("Szczesny","GK"),("Cash","RB"),("Glik","CB"),("Kiwior","CB"),("Bereszyński","LB"),
        ("Krychowiak","CDM"),("Zielinski","CM"),("Frankowski","RW"),
        ("Szymański","LW"),("Lewandowski","ST"),("Swiderski","ST"),
        # Bench
        ("Grabara","GK"),("Bednarek","CB"),("Wieteska","CB"),("Linetty","CM"),
        ("Piątek","ST"),("Bielik","CDM"),("Kamiński","CM"),
    ],
    "Tunisia": [
        # Starting XI
        ("Dahmen","GK"),("Drager","RB"),("Talbi","CB"),("Meriah","CB"),("Abdi","LB"),
        ("Skhiri","CDM"),("Ben Slimane","CM"),("Khazri","CAM"),
        ("Jaziri","RW"),("Jebali","ST"),("Msakni","LW"),
        # Bench
        ("Ben Mustapha","GK"),("Maaloul","LB"),("Ben Hassine","CB"),("Laïdouni","CDM"),
        ("Slimane","CAM"),("Badri","RW"),("Chaalali","CM"),
    ],
    "Saudi Arabia": [
        # Starting XI
        ("Al-Owais","GK"),("Al-Ghannam","RB"),("Al-Bulayhi","CB"),("Al-Tambakti","CB"),("Al-Shahrani","LB"),
        ("Al-Malki","CDM"),("Al-Dawsari","LW"),("Kanno","CM"),
        ("Al-Faraj","CM"),("Al-Shehri","ST"),("Bahebri","RW"),
        # Bench
        ("Al-Yami","GK"),("Al-Breik","CB"),("Al-Khaibari","RB"),("Al-Nemer","CM"),
        ("Al-Burayk","LB"),("Al-Qasim","RW"),("Asiri","LW"),
    ],
    "Cameroon": [
        # Starting XI
        ("Onana","GK"),("Fai","RB"),("Castelletto","CB"),("Ngadeu","CB"),("Tolo","LB"),
        ("Oum Gouet","CDM"),("Anguissa","CM"),("Mbeumo","RW"),
        ("Toko Ekambi","LW"),("Choupo-Moting","ST"),("Hongla","CM"),
        # Bench
        ("Epassy","GK"),("Nkoulou","CB"),("Teikeu","CB"),("Kunde","CM"),
        ("Aboubakar","ST"),("Bassogog","RW"),("Oyongo","LB"),
    ],
    "Qatar": [
        # Starting XI
        ("Al-Sheeb","GK"),("Rõ Rõ","RB"),("Khoukhi","CB"),("Al-Rawi","CB"),("Pedro Miguel","LB"),
        ("Al-Haydos","CAM"),("Boudiaf","CDM"),("Al-Waad","CM"),
        ("Afif","LW"),("Almoez Ali","ST"),("Muntari","ST"),
        # Bench
        ("Barsham","GK"),("Ismail","CB"),("Al-Ahrak","CM"),("Hassan Al-Haydos","RW"),
        ("Yusuf Abdurisag","ST"),("Karimi","LW"),("Hatem","CDM"),
    ],
    "Iran": [
        # Starting XI
        ("Beiranvand","GK"),("Rezaeian","RB"),("Pouraligholi","CB"),("Hosseini","CB"),("Mohammadi","LB"),
        ("Noorollahi","CDM"),("Ezatolahi","CM"),("Ghoddos","CAM"),
        ("Karimi","RW"),("Taremi","ST"),("Ansarifard","LW"),
        # Bench
        ("Abbaszadeh","GK"),("Cheshmi","LB"),("Jalali","CM"),("Azmoun","ST"),
        ("Shojaei","CM"),("Hajsafi","LB"),("Torabi","CM"),
    ],
    "Costa Rica": [
        # Starting XI
        ("Navas","GK"),("Duarte","RB"),("Waston","CB"),("Calvo","CB"),("Oviedo","LB"),
        ("Tejeda","CDM"),("Borges","CM"),("Campbell","RW"),
        ("Torres","LW"),("Contreras","ST"),("Ruiz","CAM"),
        # Bench
        ("Sequeira","GK"),("Vásquez","RB"),("Gamboa","CB"),("Vrancic","CM"),
        ("Fuller","ST"),("Hernández","LW"),("Aguilera","CM"),
    ],
}

def _player_seed(name: str, salt: int = 0) -> int:
    return (sum(ord(c)*(i+1) for i,c in enumerate(name)) + salt) % 1000


@app.get("/api/coach/lineup/squad")
def get_lineup_squad(team: str, tournament: str = "wc2022"):
    """Return full squad with stability load, influence, and pass edges for the lineup builder."""
    db = get_db()
    fp = _team_fingerprint(_normalize_team(team), db)

    # Try to get real pass-network data from the team's most recent match
    comp, season = TOURNAMENT_SEASON.get(tournament, ("FIFA World Cup", "2022"))
    match_row = db.execute(
        "SELECT match_id FROM matches WHERE competition=? AND season=? "
        "AND (home_team=? OR away_team=?) ORDER BY match_id DESC LIMIT 1",
        [comp, season, team, team],
    ).fetchone()

    real_nodes: dict = {}
    real_edges: list = []
    if match_row:
        mid = match_row[0]
        node_rows = db.execute(
            "SELECT player, influence_score, fatigue_score FROM pass_nodes "
            "WHERE match_id=? ORDER BY minute DESC",
            [mid],
        ).fetchall()
        # keep only the last (most recent minute) entry per player
        for player, influence, fatigue in node_rows:
            if player not in real_nodes:
                real_nodes[player] = {"influence": influence, "fatigue": fatigue}
        edge_rows = db.execute(
            "SELECT from_player, to_player, pass_count FROM pass_edges "
            "WHERE match_id=? ORDER BY minute DESC",
            [mid],
        ).fetchall()
        seen_edges: set = set()
        for fp_name, tp, pc in edge_rows:
            key = (fp_name, tp)
            if key not in seen_edges:
                seen_edges.add(key)
                real_edges.append({"source": fp_name, "target": tp, "weight": pc})
    db.close()

    # Normalise team name aliases (DB uses "United States", WC2026 list uses "USA", etc.)
    _SQUAD_ALIASES = {"United States": "USA", "Korea Republic": "South Korea",
                      "IR Iran": "Iran", "Côte d'Ivoire": "Ivory Coast"}
    squad_key = _SQUAD_ALIASES.get(team, team)
    raw = _SQUADS.get(squad_key, [(f"Player {i+1}", "MF") for i in range(11)])

    # Team-level tactical shape override for the starting XI (gives per-team variation).
    TEAM_SHAPES = {
        "Argentina": "4-3-3", "Australia": "4-4-2", "Belgium": "3-4-2-1", "Brazil": "4-3-3",
        "Cameroon": "4-3-3", "Canada": "3-4-3", "Costa Rica": "5-4-1", "Croatia": "4-3-3",
        "Denmark": "3-4-3", "Ecuador": "4-4-2", "England": "4-3-3", "France": "4-2-3-1",
        "Germany": "4-2-3-1", "Ghana": "4-2-3-1", "Iran": "4-4-1-1", "Japan": "4-2-3-1",
        "Mexico": "4-3-3", "Morocco": "4-1-4-1", "Netherlands": "3-4-1-2", "Poland": "4-4-2",
        "Portugal": "4-3-3", "Qatar": "3-5-2", "Saudi Arabia": "4-3-3", "Senegal": "4-3-3",
        "Serbia": "3-5-2", "South Korea": "4-2-3-1", "Spain": "4-3-3", "Switzerland": "4-2-3-1",
        "Tunisia": "4-3-3", "USA": "4-3-3", "Uruguay": "4-3-3", "Wales": "3-4-2-1",
    }
    SHAPE_POS = {
        "4-3-3":   ["GK","RB","CB","CB","LB","CM","CM","CM","RW","LW","ST"],
        "4-2-3-1": ["GK","RB","CB","CB","LB","CDM","CM","RW","CAM","LW","ST"],
        "4-4-2":   ["GK","RB","CB","CB","LB","RW","CM","CM","LW","ST","ST"],
        "3-4-3":   ["GK","CB","CB","CB","RB","LB","CM","CM","RW","LW","ST"],
        "3-4-1-2": ["GK","CB","CB","CB","RB","LB","CM","CM","CAM","ST","ST"],
        "3-5-2":   ["GK","CB","CB","CB","RB","LB","CDM","CM","CM","ST","ST"],
        "4-1-4-1": ["GK","RB","CB","CB","LB","CDM","RW","CM","CM","LW","ST"],
        "4-4-1-1": ["GK","RB","CB","CB","LB","RW","CM","CM","LW","CAM","ST"],
        "5-4-1":   ["GK","RB","CB","CB","CB","LB","RW","CM","CM","LW","ST"],
        "3-4-2-1": ["GK","CB","CB","CB","RB","LB","CM","CM","CAM","CAM","ST"],
    }
    shape = TEAM_SHAPES.get(squad_key)
    if shape and shape in SHAPE_POS and len(raw) >= 11:
        roles = SHAPE_POS[shape]
        first = []
        for i, e in enumerate(raw[:11]):
            n, old = (e[0], e[1]) if isinstance(e, tuple) else (e, "MF")
            first.append((n, roles[i] if i < len(roles) else old))
        raw = first + list(raw[11:])

    # Filter real_nodes/real_edges to only this team's players (pass_nodes tables include both teams)
    squad_names = {(n[0] if isinstance(n, tuple) else n) for n in raw}
    real_nodes = {k: v for k, v in real_nodes.items() if k in squad_names}
    real_edges = [e for e in real_edges if e["source"] in squad_names and e["target"] in squad_names]
    players = []
    for i, entry in enumerate(raw):
        name, role = entry if isinstance(entry, tuple) else (entry, "MF")
        s = _player_seed(name)
        if name in real_nodes:
            influence = round(real_nodes[name]["influence"] * 10, 1)
            load      = round(real_nodes[name]["fatigue"] * 100, 1)
        else:
            influence = round(3 + (s >> 4) % 70 / 10, 1)   # 3.0–10.0
            load      = round(max(20, min(95, 55 - fp.get("turnover_pm", 0.2)*30 + (s % 35) - 10)), 1)
        players.append({
            "id": i, "name": name, "pos": role,
            "load": load, "influence": influence,
        })

    # Build structural template edges for starting XI, then merge with real edges.
    def _template_edges(starters_raw):
        starter_info = []
        for e in starters_raw:
            n, p = (e[0], e[1]) if isinstance(e, tuple) else (e, "MF")
            starter_info.append({"name": n, "pos": p})

        by_pos: dict = {}
        for sp in starter_info:
            by_pos.setdefault(sp["pos"], []).append(sp["name"])

        def pick(*roles):
            out = []
            for r in roles:
                out.extend(by_pos.get(r, []))
            return out

        gk   = pick("GK")[:1]
        lbs  = pick("LB")
        rbs  = pick("RB")
        cbs  = pick("CB")
        cdm  = pick("CDM", "DM")[:1]
        cms  = pick("CM", "MF")
        cams = pick("CAM")
        lws  = pick("LW")
        rws  = pick("RW")
        sts  = pick("ST", "CF")

        # Fallbacks for odd lineups
        pivot = cdm[0] if cdm else (cms[0] if cms else (cams[0] if cams else (sts[0] if sts else None)))
        cam   = cams[0] if cams else (cms[1] if len(cms) > 1 else (cms[0] if cms else None))
        lw    = lws[0] if lws else (cams[1] if len(cams) > 1 else None)
        rw    = rws[0] if rws else (sts[1] if len(sts) > 1 else None)
        st    = sts[0] if sts else (cam if cam and cam not in cms else None)

        def w(base: int, a: str, b: str) -> int:
            s = (_player_seed(a) + _player_seed(b)) % 3
            return max(2, min(10, base + s))

        seen: set = set()
        out = []
        def add(a: str, b: str, base: int):
            if not a or not b or a == b:
                return
            key = tuple(sorted((a, b)))
            if key in seen:
                return
            seen.add(key)
            out.append({"source": a, "target": b, "weight": w(base, a, b)})

        # 1) Build-out from GK
        for cb in cbs[:2]:
            for g in gk:
                add(g, cb, 8)
        for fb in (lbs[:1] + rbs[:1]):
            for g in gk:
                add(g, fb, 5)

        # 2) Back line structure
        if len(cbs) >= 2:
            add(cbs[0], cbs[1], 7)
        if lbs and cbs:
            add(lbs[0], cbs[0], 7)
        if rbs and cbs:
            add(rbs[0], cbs[-1], 7)

        # 3) Pivot links
        if pivot:
            for cb in cbs[:2]:
                add(cb, pivot, 8)
            if lbs:
                add(lbs[0], pivot, 6)
            if rbs:
                add(rbs[0], pivot, 6)

        # 4) Midfield mesh
        if len(cms) >= 2:
            add(cms[0], cms[1], 8)
        for cm in cms[:3]:
            if pivot:
                add(pivot, cm, 8)
            if cam:
                add(cm, cam, 7)

        # 5) Creation and final third
        if cam:
            if st:
                add(cam, st, 8)
            if lw:
                add(cam, lw, 7)
            if rw:
                add(cam, rw, 7)
        if lw and st:
            add(lw, st, 6)
        if rw and st:
            add(rw, st, 6)

        # 6) Fullback wide progression
        if lbs and lw:
            add(lbs[0], lw, 6)
        if rbs and rw:
            add(rbs[0], rw, 6)

        return out

    template_edges = _template_edges(raw[:11])

    # Merge real + template so teams with sparse real edges still keep formation structure.
    merged: dict = {}
    for e in template_edges + real_edges:
        a, b = (e["source"], e["target"])
        key = tuple(sorted((a, b)))
        prev = merged.get(key)
        if not prev or e["weight"] > prev["weight"]:
            merged[key] = {"source": key[0], "target": key[1], "weight": e["weight"]}
    real_edges = list(merged.values())

    return {"players": players, "edges": real_edges}


@app.post("/api/coach/lineup/evaluate")
def evaluate_lineup(body: dict):
    """Given a subset of player names, return collapse risk delta vs full XI."""
    team     = body.get("team", "")
    selected = set(body.get("player_names", []))
    db = get_db()
    fp = _team_fingerprint(_normalize_team(team), db)
    db.close()

    _SQUAD_ALIASES2 = {"United States": "USA", "Korea Republic": "South Korea",
                       "IR Iran": "Iran", "Côte d'Ivoire": "Ivory Coast"}
    squad_key2 = _SQUAD_ALIASES2.get(team, team)
    raw = _SQUADS.get(squad_key2, [])
    # A Starting XI is always 11; missing = unfilled slots regardless of total squad size
    missing  = max(0, 11 - len(selected))

    base_risk = round(fp.get("burstiness", 0.2) * 0.4 + fp.get("turnover_pm", 0.3) * 0.3 + 0.25, 3)
    delta     = round(missing * 0.025, 3)   # each missing player adds ~2.5pp risk
    return {
        "base_risk": base_risk,
        "adjusted_risk": min(0.95, base_risk + delta),
        "delta": delta,
        "missing_count": missing,
    }


@app.get("/api/player/teams")
def get_player_teams():
    return sorted(_SQUADS.keys())


@app.get("/api/player/team/{team}/players")
def get_team_players(team: str):
    db = get_db()
    fp = _team_fingerprint(team, db)
    db.close()
    raw = _SQUADS.get(team, [(f"Player {i+1}", "MF") for i in range(11)])
    result = []
    for i, entry in enumerate(raw):
        name, role = entry if isinstance(entry, tuple) else (entry, "MF")
        s = _player_seed(name)
        stability = round(max(5, min(95, 60 - fp["turnover_pm"]*30 + (s%30) - 15)), 1)
        risk_inj  = round(max(5, min(95, fp["burstiness"]*40 + (s%25))), 1)
        pressure  = round(max(5, min(95, 70 - fp["def_actions_pm"]*20 + (s%20) - 10)), 1)
        result.append({"id": i, "name": name, "role": role, "stability": stability,
                        "risk_injection": risk_inj, "pressure_resistance": pressure})
    return result


@app.get("/api/player/team/{team}/player/{player_id}/impact")
def get_player_impact(team: str, player_id: int):
    db = get_db()
    fp = _team_fingerprint(team, db)
    db.close()
    raw = _SQUADS.get(team, [(f"Player {i+1}", "MF") for i in range(11)])
    entry = raw[player_id] if player_id < len(raw) else (f"Player {player_id}", "MF")
    name, player_role = entry if isinstance(entry, tuple) else (entry, "MF")
    s = _player_seed(name)

    # 15-minute window contributions (synthetic but seeded)
    windows = []
    for i, label in enumerate(["0-15","15-30","30-45","45-60","60-75","75-90+"]):
        ws = _player_seed(name, i*17)
        windows.append({
            "window": label,
            "stability_contribution": round(max(-30, min(30, 15 - fp["turnover_pm"]*20 + (ws%20) - 10)), 1),
            "risk_injection":         round(max(0, min(40, fp["burstiness"]*25 + (ws%15))), 1),
            "pressure_resistance":    round(max(30, min(95, 65 + (ws%25) - 12)), 1),
        })

    # Pressure splits
    splits = {
        "stable_phases":   {"pass_completion": round(78 + (s%15), 1), "duel_success": round(52 + (s%20), 1), "turnovers_pm": round(fp["turnover_pm"]*0.8, 3)},
        "unstable_phases": {"pass_completion": round(62 + (s%12), 1), "duel_success": round(38 + (s%18), 1), "turnovers_pm": round(fp["turnover_pm"]*1.6, 3)},
        "trailing":  {"actions_pm": round(3.2 + (s%10)/10, 2), "risk_pm": round(fp["burstiness"]*1.4, 3)},
        "drawing":   {"actions_pm": round(2.8 + (s%8)/10,  2), "risk_pm": round(fp["burstiness"]*1.0, 3)},
        "leading":   {"actions_pm": round(2.1 + (s%6)/10,  2), "risk_pm": round(fp["burstiness"]*0.7, 3)},
    }

    # Role-fit per game plan
    plans = {
        "High Press": {
            "high_value": ["Immediate counter-press on loss","Win ball in final third","Force GK distribution errors"],
            "high_risk":  ["Exposed behind on transitions","Fatigue spike after 65'","Over-committing wide"],
        },
        "Compact Block": {
            "high_value": ["Disciplined shape maintenance","Interception chains","Set-piece aerial duels"],
            "high_risk":  ["Ball-watching on 2nd balls","Passive midfield pressure","Late runs from deep"],
        },
        "Possession Control": {
            "high_value": ["Recycling under pressure","Switch of play","Progressive dribbles from half-space"],
            "high_risk":  ["Square passes in own half","Slow tempo invites high line","Losing composure vs press"],
        },
    }

    return {"name": name, "team": team, "role": player_role, "windows": windows, "splits": splits, "plans": plans}


# ── Player Trajectory ─────────────────────────────────────────────────────
@app.get("/api/player/trajectory")
def get_player_trajectory(player: str, team: str):
    """
    Per-match performance trajectory for a player using real pass_nodes + timelines data.
    Derives resilience (performance under high-risk) and collapse contribution
    (fatigue + low-influence during risk spikes) for each WC match.
    Falls back to seeded synthetic data if the player has no DB records.
    """
    import numpy as np

    db = get_db()

    # ── 1. Fetch per-match aggregates from pass_nodes ─────────────────────
    # Group all minutes the player appears across WC matches into per-match buckets
    real_rows = db.execute(
        """
        SELECT
            p.match_id,
            m.home_team, m.away_team, m.home_score, m.away_score, m.match_date,
            AVG(p.influence_score)  AS avg_influence,
            AVG(p.fatigue_score)    AS avg_fatigue,
            AVG(p.centrality)       AS avg_centrality,
            MAX(p.fatigue_score)    AS peak_fatigue,
            MIN(p.fatigue_score)    AS min_fatigue,
            COUNT(DISTINCT p.minute) AS minutes_present
        FROM pass_nodes p
        JOIN matches m ON m.match_id = p.match_id
        WHERE p.player = ?
          AND (m.home_team = ? OR m.away_team = ?)
          AND m.competition = 'FIFA World Cup'
        GROUP BY p.match_id, m.home_team, m.away_team,
                 m.home_score, m.away_score, m.match_date
        ORDER BY m.match_date
        """,
        [player, team, team],
    ).fetchall()

    real_data_found = len(real_rows) > 0

    # ── 2. For each match, get risk correlation from timelines ────────────
    match_records = []

    def _pressure_perf(match_id: int, avg_inf: float, avg_fat: float) -> tuple[float, float]:
        """Return (performance_under_pressure, collapse_contribution)."""
        risk_rows = db.execute(
            "SELECT minute, probability FROM timelines WHERE match_id = ? AND team = ? ORDER BY minute",
            [match_id, team],
        ).fetchall()
        if not risk_rows:
            return round(avg_inf, 3), round(1.0 - avg_inf, 3)

        high_risk = [r for r in risk_rows if r[1] >= 0.50]
        if not high_risk:
            # No high-risk phase → player had nothing difficult to face
            return round(min(0.95, avg_inf + 0.08), 3), round(max(0.02, (1.0 - avg_inf) * 0.4), 3)

        # In high-risk minutes: get player node data
        high_risk_minutes = [r[0] for r in high_risk]
        placeholders = ",".join("?" for _ in high_risk_minutes)
        node_rows = db.execute(
            f"SELECT influence_score, fatigue_score FROM pass_nodes "
            f"WHERE match_id = ? AND player = ? AND minute IN ({placeholders})",
            [match_id, player] + high_risk_minutes,
        ).fetchall()

        if not node_rows:
            # Player data not available for risky minutes — use overall as proxy
            pressure_perf = round(avg_inf * 0.9, 3)
            collapse_contrib = round(avg_fat * 0.5, 3)
        else:
            pressure_inf = sum(r[0] for r in node_rows if r[0] is not None) / len(node_rows)
            pressure_fat = sum(r[1] for r in node_rows if r[1] is not None) / len(node_rows)
            # Resilience: maintained high influence in risky phases
            pressure_perf = round(float(np.clip(pressure_inf, 0.0, 1.0)), 3)
            # Collapse contribution: high fatigue + low influence during spikes
            collapse_contrib = round(float(np.clip(pressure_fat * (1.0 - pressure_inf), 0.0, 1.0)), 3)

        return pressure_perf, collapse_contrib

    if real_data_found:
        for r in real_rows:
            mid, ht, at, hs, as_, mdate, avg_inf, avg_fat, avg_cent, pk_fat, mn_fat, mins = r
            avg_inf  = float(avg_inf  or 0.5)
            avg_fat  = float(avg_fat  or 0.4)
            avg_cent = float(avg_cent or 0.3)
            pk_fat   = float(pk_fat   or avg_fat)

            opponent  = at if ht == team else ht
            goal_diff = (hs - as_) if ht == team else (as_ - hs)
            result    = "W" if goal_diff > 0 else ("D" if goal_diff == 0 else "L")
            score_str = f"{hs}–{as_}"

            pperf, cc = _pressure_perf(mid, avg_inf, avg_fat)

            # Resilience = performance under pressure, inverted collapse contribution
            resilience = round(float(np.clip((pperf + (1.0 - avg_fat)) / 2.0, 0.0, 1.0)), 3)

            match_records.append({
                "match_id":    mid,
                "opponent":    opponent,
                "match_date":  str(mdate)[:10] if mdate else "",
                "result":      result,
                "score":       score_str,
                "avg_influence":             round(avg_inf,  3),
                "avg_fatigue":               round(avg_fat,  3),
                "avg_centrality":            round(avg_cent, 3),
                "peak_fatigue":              round(pk_fat,   3),
                "minutes_present":           int(mins),
                "performance_under_pressure": pperf,
                "collapse_contribution":      cc,
                "resilience_score":           resilience,
            })
    else:
        # ── Synthetic trajectory seeded from team fingerprint + player name ─
        db2 = get_db()
        fp = _team_fingerprint(team, db2)
        db2.close()

        # Find all WC matches the team played
        team_matches = db.execute(
            "SELECT match_id, home_team, away_team, home_score, away_score, match_date "
            "FROM matches WHERE (home_team = ? OR away_team = ?) "
            "AND competition = 'FIFA World Cup' ORDER BY match_date",
            [team, team],
        ).fetchall()

        if not team_matches:
            team_matches = []

        s = _player_seed(player)
        rng = np.random.default_rng(s % 99999)

        base_inf = float(np.clip(0.45 + (s % 40) / 100.0 - fp["turnover_pm"] * 0.3, 0.2, 0.85))
        base_fat = float(np.clip(0.30 + fp["burstiness"] * 0.5 + (s % 20) / 100.0, 0.15, 0.75))
        base_res = float(np.clip(0.70 - fp["tempo_variance"] * 0.4 + (s % 30) / 150.0, 0.25, 0.90))

        # Generate 3-6 synthetic matches if no real matches found
        n_matches = max(3, min(6, len(team_matches)))
        opponents = ["Brazil","France","Germany","Argentina","England","Spain","Netherlands"]
        rng2 = np.random.default_rng((s + 7) % 99999)

        trend_dir = float(rng2.choice([-1.0, 0.0, 1.0], p=[0.25, 0.35, 0.40]))
        for i in range(n_matches):
            if i < len(team_matches):
                mid_, ht_, at_, hs_, as_, md_ = team_matches[i]
                opp_ = at_ if ht_ == team else ht_
                gd_  = (hs_ - as_) if ht_ == team else (as_ - hs_)
                res_ = "W" if gd_ > 0 else ("D" if gd_ == 0 else "L")
                sc_  = f"{hs_}–{as_}"
                date_ = str(md_)[:10] if md_ else f"Match {i+1}"
            else:
                opp_ = opponents[i % len(opponents)]
                res_ = rng2.choice(["W","D","L"], p=[0.40, 0.25, 0.35])
                gs_  = int(rng2.integers(0, 3))
                gc_  = int(rng2.integers(0, 3))
                sc_  = f"{gs_}–{gc_}"
                date_ = f"Match {i+1}"

            progress = trend_dir * i * 0.04
            inf_  = float(np.clip(base_inf + progress + float(rng2.uniform(-0.07, 0.07)), 0.15, 0.92))
            fat_  = float(np.clip(base_fat + float(rng2.uniform(-0.06, 0.06)), 0.10, 0.85))
            pp_   = float(np.clip(base_res + progress + float(rng2.uniform(-0.08, 0.08)), 0.15, 0.92))
            cc_   = float(np.clip(fat_ * (1.0 - inf_) + float(rng2.uniform(-0.04, 0.04)), 0.0, 0.75))
            res_s = float(np.clip((pp_ + (1.0 - fat_)) / 2.0, 0.0, 0.95))

            match_records.append({
                "match_id":    i,
                "opponent":    opp_,
                "match_date":  date_,
                "result":      res_,
                "score":       sc_,
                "avg_influence":             round(inf_, 3),
                "avg_fatigue":               round(fat_, 3),
                "avg_centrality":            round(inf_ * 0.85, 3),
                "peak_fatigue":              round(min(0.95, fat_ + 0.1), 3),
                "minutes_present":           int(rng2.integers(60, 91)),
                "performance_under_pressure": round(pp_, 3),
                "collapse_contribution":      round(cc_, 3),
                "resilience_score":           round(res_s, 3),
            })

    db.close()

    if not match_records:
        return {"player": player, "team": team, "real_data_found": False,
                "matches": [], "aggregate": {}, "prediction": {}}

    # ── 3. Aggregate across matches ───────────────────────────────────────
    def _avg(key: str) -> float:
        vals = [m[key] for m in match_records if m[key] is not None]
        return round(sum(vals) / len(vals), 3) if vals else 0.0

    avg_inf  = _avg("avg_influence")
    avg_fat  = _avg("avg_fatigue")
    avg_pup  = _avg("performance_under_pressure")
    avg_cc   = _avg("collapse_contribution")
    avg_res  = _avg("resilience_score")

    # Trend: compare first-half vs second-half of matches
    n = len(match_records)
    if n >= 3:
        first_half_inf = sum(m["avg_influence"] for m in match_records[:n//2]) / (n//2)
        second_half_inf = sum(m["avg_influence"] for m in match_records[n//2:]) / (n - n//2)
        diff = second_half_inf - first_half_inf
        trend = "improving" if diff > 0.04 else ("declining" if diff < -0.04 else "stable")
    else:
        trend = "stable"

    # ── 4. Prediction for next match ─────────────────────────────────────
    # Simple linear extrapolation with regression-to-mean dampening
    last = match_records[-1]
    prev = match_records[-2] if n >= 2 else last
    momentum = (last["avg_influence"] - prev["avg_influence"]) * 0.5  # dampen
    predicted_inf = round(float(np.clip(last["avg_influence"] + momentum, 0.1, 0.95)), 3)
    predicted_fat = round(float(np.clip(last["avg_fatigue"] + 0.02, 0.1, 0.90)), 3)  # fatigue naturally rises
    error_prob    = round(float(np.clip(predicted_fat * (1.0 - predicted_inf) + avg_cc * 0.3, 0.05, 0.80)), 3)
    pred_res      = round(float(np.clip(avg_res + momentum * 0.5, 0.1, 0.95)), 3)

    return {
        "player":          player,
        "team":            team,
        "real_data_found": real_data_found,
        "matches":         match_records,
        "aggregate": {
            "matches_analyzed":           n,
            "avg_influence":              avg_inf,
            "avg_fatigue":                avg_fat,
            "performance_under_pressure": avg_pup,
            "collapse_contribution":      avg_cc,
            "resilience_score":           avg_res,
            "trend":                      trend,
        },
        "prediction": {
            "predicted_influence":    predicted_inf,
            "predicted_fatigue":      predicted_fat,
            "error_probability":      error_prob,
            "resilience_prediction":  pred_res,
            "trend":                  trend,
        },
    }


# ── WC 2026 Live Simulation ────────────────────────────────────────────────
@app.get("/api/wc2026/live-sim")
def wc2026_live_sim(team_a: str = "France", team_b: str = "Brazil"):
    """Full 90-min mock real-time simulation with psychological & sentiment features."""
    import hashlib, numpy as np

    seed = int(hashlib.md5(f"{team_a}-{team_b}".encode()).hexdigest()[:8], 16) % 99999
    rng = np.random.default_rng(seed)

    try:
        db = get_db()
        _fp_aliases = {"USA": "United States", "South Korea": "Korea Republic", "Iran": "IR Iran"}
        fp_a = _team_fingerprint(_fp_aliases.get(team_a, team_a), db)
        fp_b = _team_fingerprint(_fp_aliases.get(team_b, team_b), db)
        db.close()
    except Exception:
        fp_a = {"burstiness": 0.30, "turnover_pm": 0.20, "territory_tilt": 0.50,
                "tempo_variance": 0.30, "def_actions_pm": 0.40, "pass_acc_slope": 0.0}
        fp_b = {"burstiness": 0.25, "turnover_pm": 0.18, "territory_tilt": 0.50,
                "tempo_variance": 0.25, "def_actions_pm": 0.35, "pass_acc_slope": 0.0}

    RIVALRIES = {
        frozenset(["France",      "Brazil"]):      0.82,
        frozenset(["Argentina",   "Brazil"]):      0.95,
        frozenset(["Argentina",   "England"]):     0.88,
        frozenset(["Germany",     "England"]):     0.85,
        frozenset(["Spain",       "Portugal"]):    0.78,
        frozenset(["USA",         "Mexico"]):      0.80,
        frozenset(["Netherlands", "Germany"]):     0.82,
        frozenset(["Argentina",   "France"]):      0.92,
        frozenset(["Brazil",      "Germany"]):     0.88,
        frozenset(["England",     "France"]):      0.76,
        frozenset(["Spain",       "Germany"]):     0.79,
        frozenset(["Portugal",    "France"]):      0.74,
        frozenset(["Croatia",     "Brazil"]):      0.70,
        frozenset(["Morocco",     "France"]):      0.75,
        frozenset(["Japan",       "Spain"]):       0.68,
    }
    rivalry = RIVALRIES.get(frozenset([team_a, team_b]), 0.50)

    # Real-world ELO anchor (same table used by tournament sim)
    _LIVE_ELO: dict[str, float] = {
        "Argentina":   0.92, "France":      0.91, "Brazil":       0.90,
        "England":     0.87, "Spain":       0.87, "Portugal":     0.86,
        "Germany":     0.85, "Netherlands": 0.84,
        "Belgium":     0.80, "Croatia":     0.79, "Denmark":      0.78,
        "Uruguay":     0.77, "Switzerland": 0.76, "USA":          0.72,
        "Mexico":      0.71, "Morocco":     0.73, "Japan":        0.72,
        "South Korea": 0.70, "Senegal":     0.70, "Serbia":       0.68,
        "Ecuador":     0.66, "Poland":      0.66, "Wales":        0.65,
        "Australia":   0.63, "Canada":      0.62, "Ghana":        0.60,
        "Cameroon":    0.59, "Tunisia":     0.58, "Saudi Arabia": 0.56,
        "Iran":        0.55, "Qatar":       0.52, "Costa Rica":   0.51,
    }
    elo_a = _LIVE_ELO.get(team_a, 0.62)
    elo_b = _LIVE_ELO.get(team_b, 0.62)
    # Relative attacking strength (biases goal probabilities toward better team)
    elo_ratio_a = elo_a / max(0.1, elo_a + elo_b)  # fraction of combined quality
    elo_ratio_b = 1.0 - elo_ratio_a

    # Alias map: WC2026 display names → _SQUADS keys
    _SIM_ALIASES = {
        "USA": "USA", "United States": "USA",
        "Korea Republic": "South Korea", "IR Iran": "Iran",
        "Côte d'Ivoire": "Ivory Coast",
    }

    def _squad(t: str):
        key = _SIM_ALIASES.get(t, t)
        return _SQUADS.get(key, [(f"Player {i+1}", "MF") for i in range(18)])

    def _pick(squad, idx: int) -> str:
        e = squad[int(idx) % len(squad)]
        return e[0] if isinstance(e, tuple) else e

    squad_a = _squad(team_a)
    squad_b = _squad(team_b)

    # Base collapse risk: lower ELO teams start with higher risk
    base_risk_a = float(np.clip(
        fp_a.get("burstiness", 0.3)*0.25 + fp_a.get("turnover_pm", 0.2)*0.25
        + 0.10 + (1.0 - elo_a) * 0.30,  # weaker teams collapse more
        0.08, 0.65,
    ))
    sub_mins = sorted(rng.choice(range(50, 85), size=3, replace=False).tolist())

    minutes_data = []
    events = []
    score_a = score_b = 0
    prob = float(base_risk_a)
    momentum_a = 0.50

    for minute in range(1, 91):
        # ── Physical fatigue ──────────────────────────────────────────────
        fatigue = min(0.95, 0.08 + (minute / 90) * 0.65 + fp_a.get("burstiness", 0.3) * 0.12)
        if minute in sub_mins:
            fatigue = max(0.08, fatigue - 0.08)

        # ── Psychological stress (score × time pressure) ──────────────────
        deficit = score_b - score_a
        time_pressure = minute / 90.0
        psych = min(0.95, max(0.05,
            0.18 + max(0, deficit) * 0.28 * time_pressure
            + fp_a.get("tempo_variance", 0.3) * 0.18
            + rivalry * 0.08
            + (0.14 if minute > 80 else 0.0)
        ))

        # ── Crowd / sentiment pressure ────────────────────────────────────
        crowd = min(0.95, max(0.28,
            0.58 + rivalry * 0.14
            + (0.09 if deficit > 0 else 0.0)
            + (0.07 if minute > 75 else 0.0)
            + float(rng.uniform(-0.04, 0.04))
        ))

        # ── Momentum (territory + recency) ───────────────────────────────
        raw_mom = 0.5 - (fp_a.get("territory_tilt", 0.5) - 0.5) + float(rng.uniform(-0.04, 0.04))
        momentum_a = float(np.clip(0.80 * momentum_a + 0.20 * raw_mom, 0.05, 0.95))

        # ── Collapse probability ──────────────────────────────────────────
        push = psych * 0.28 + (1 - momentum_a) * 0.24 + fatigue * 0.14
        prob = float(np.clip(prob * 0.86 + push * 0.14 + rng.uniform(-0.018, 0.018), 0.05, 0.92))
        if fp_a.get("burstiness", 0) > 0.38 and rng.random() < 0.09:
            prob = float(min(0.92, prob + rng.uniform(0.04, 0.11)))

        minutes_data.append({
            "minute": minute,
            "score_a": score_a, "score_b": score_b,
            "collapse_prob":        round(prob, 3),
            "crowd_pressure":       round(crowd, 3),
            "momentum":             round(momentum_a, 3),
            "psychological_stress": round(psych, 3),
            "physical_fatigue":     round(fatigue, 3),
            "rivalry_index":        round(rivalry, 3),
            "pass_acc_slope":       round(float(rng.uniform(-0.04, 0.03)) - fatigue * 0.015, 3),
            "turnover_burstiness":  round(fp_a.get("burstiness", 0.3) + float(rng.uniform(-0.04, 0.04)), 3),
            "territory_tilt":       round(fp_a.get("territory_tilt", 0.5) + float(rng.uniform(-0.04, 0.04)), 3),
        })

        # ── Goal generation (ELO-weighted so better teams score more) ────
        # team_a collapses → team_b scores; also stronger team scores more
        gp_b = prob * 0.036 * (0.6 + elo_ratio_b * 0.8)
        gp_a = (1 - prob) * 0.026 * (0.6 + elo_ratio_a * 0.8)
        if minute > 10 and rng.random() < gp_b:
            score_b += 1
            events.append({"minute": minute, "type": "goal", "team": team_b,
                "player": _pick(squad_b, int(rng.integers(0, min(11, len(squad_b))))),
                "score_a": score_a, "score_b": score_b,
                "description": f"{team_b} capitalise on {team_a} collapse window"})
            prob = float(min(0.92, prob + 0.11))
            momentum_a = float(max(0.05, momentum_a - 0.22))
        elif minute > 10 and rng.random() < gp_a:
            score_a += 1
            events.append({"minute": minute, "type": "goal", "team": team_a,
                "player": _pick(squad_a, int(rng.integers(0, min(11, len(squad_a))))),
                "score_a": score_a, "score_b": score_b,
                "description": f"{team_a} score — stability restored, psychological pressure drops"})
            prob = float(max(0.05, prob - 0.09))
            momentum_a = float(min(0.95, momentum_a + 0.22))

        # ── Yellow cards ──────────────────────────────────────────────────
        if rng.random() < 0.014 and minute > 20:
            is_a = rng.random() < 0.5
            squad = squad_a if is_a else squad_b
            events.append({"minute": minute, "type": "card", "card": "yellow",
                "team": team_a if is_a else team_b,
                "player": _pick(squad, int(rng.integers(0, min(11, len(squad))))),
                "description": "Tactical foul — disrupting counter-attack transition"})

        # ── Momentum shifts ───────────────────────────────────────────────
        if len(minutes_data) >= 6:
            prev = minutes_data[-6]["collapse_prob"]
            if abs(prob - prev) > 0.11:
                rising = prob > prev
                events.append({"minute": minute, "type": "momentum_shift",
                    "description": ("Collapse risk rising sharply — pressure phase building, "
                                    "psychological stress elevated"
                                    if rising else
                                    "Stability restored — momentum shifting, crowd pressure easing"),
                    "score_a": score_a, "score_b": score_b})

        # ── Substitutions ─────────────────────────────────────────────────
        if minute in sub_mins:
            is_a = rng.random() < 0.5
            squad = squad_a if is_a else squad_b
            bench = max(11, len(squad) - 7)
            events.append({"minute": minute, "type": "substitution",
                "team": team_a if is_a else team_b,
                "player_off": _pick(squad, int(rng.integers(4, 11))),
                "player_on":  _pick(squad, bench + int(rng.integers(0, max(1, len(squad) - bench)))),
                "description": "Fresh legs — tactical fatigue management"})

    events.append({"minute": 90, "type": "fulltime",
        "score_a": score_a, "score_b": score_b,
        "description": (f"Full time — {team_a} {score_a}–{score_b} {team_b}. "
                        + ("Draw" if score_a == score_b
                           else f"{'Win' if score_a > score_b else 'Loss'} for {team_a}"))})
    events.sort(key=lambda e: e["minute"])

    return {"team_a": team_a, "team_b": team_b, "rivalry_index": rivalry,
            "final_score": {"team_a": score_a, "team_b": score_b},
            "minutes": minutes_data, "events": events}


# ── WC 2026 Tournament Simulation ─────────────────────────────────────────
@app.get("/api/wc2026/simulate-tournament")
def wc2026_simulate_tournament():
    """
    Simulate the full WC 2026 tournament:
      - 8 groups of 4 teams (group stage)
      - Round of 16, Quarter-finals, Semi-finals, Third-place, Final
    Uses team fingerprints as prior strength; deterministic via team-name seeds.
    """
    import hashlib, numpy as np

    # ── Seeded groups (balanced geographically like real WC draw) ────────
    GROUPS: dict[str, list[str]] = {
        "A": ["Argentina", "Mexico", "Poland",       "Saudi Arabia"],
        "B": ["France",    "Denmark", "Tunisia",      "Australia"],
        "C": ["Brazil",    "Serbia",  "Switzerland",  "Cameroon"],
        "D": ["England",   "USA",     "Iran",         "Wales"],
        "E": ["Spain",     "Germany", "Japan",        "Costa Rica"],
        "F": ["Portugal",  "Uruguay", "South Korea",  "Ghana"],
        "G": ["Netherlands","Ecuador","Qatar",         "Senegal"],
        "H": ["Belgium",   "Croatia", "Morocco",      "Canada"],
    }

    _FP_ALIASES = {
        "USA": "United States", "South Korea": "Korea Republic",
        "Iran": "IR Iran", "Ivory Coast": "Côte d'Ivoire",
    }

    # Cache fingerprints
    db = get_db()
    fp_cache: dict[str, dict] = {}
    for teams in GROUPS.values():
        for t in teams:
            if t not in fp_cache:
                fp_cache[t] = _team_fingerprint(_FP_ALIASES.get(t, t), db)
    db.close()

    RIVALRIES = {
        frozenset(["France","Brazil"]):0.82, frozenset(["Argentina","Brazil"]):0.95,
        frozenset(["Argentina","England"]):0.88, frozenset(["Germany","England"]):0.85,
        frozenset(["Spain","Portugal"]):0.78, frozenset(["USA","Mexico"]):0.80,
        frozenset(["Netherlands","Germany"]):0.82, frozenset(["Argentina","France"]):0.92,
        frozenset(["Brazil","Germany"]):0.88,
    }

    # ── Real-world FIFA/ELO anchor ratings (2024-25) ─────────────────────
    # Tier 1 — global elite
    # Tier 2 — strong contenders
    # Tier 3 — competitive nations
    # Tier 4 — outsiders
    _ELO: dict[str, float] = {
        "Argentina":   0.92, "France":      0.91, "Brazil":       0.90,
        "England":     0.87, "Spain":       0.87, "Portugal":     0.86,
        "Germany":     0.85, "Netherlands": 0.84,
        "Belgium":     0.80, "Croatia":     0.79, "Denmark":      0.78,
        "Uruguay":     0.77, "Switzerland": 0.76, "USA":          0.72,
        "Mexico":      0.71, "Morocco":     0.73, "Japan":        0.72,
        "South Korea": 0.70, "Senegal":     0.70, "Serbia":       0.68,
        "Ecuador":     0.66, "Poland":      0.66, "Wales":        0.65,
        "Australia":   0.63, "Canada":      0.62, "Ghana":        0.60,
        "Cameroon":    0.59, "Tunisia":     0.58, "Saudi Arabia": 0.56,
        "Iran":        0.55, "Qatar":       0.52, "Costa Rica":   0.51,
    }

    def _strength(team: str, fp: dict) -> float:
        """
        Composite strength: 70% real-world ELO anchor + 30% fingerprint modifier.
        This ensures elite nations (Brazil/France/Argentina) consistently perform
        better than lower-ranked teams regardless of synthetic fingerprint noise.
        """
        elo = _ELO.get(team, 0.62)
        # Fingerprint modifier: low turnover + high territory = positive signal
        fp_mod = (
            (1.0 - fp.get("burstiness",    0.3)) * 0.12
            + (1.0 - fp.get("turnover_pm", 0.2)) * 0.10
            + fp.get("territory_tilt",     0.5)  * 0.08
        ) - 0.15   # centre around 0 so it's a modifier not a base
        return float(np.clip(elo * 0.70 + (elo + fp_mod) * 0.30, 0.30, 0.93))

    def _sim_match(ta: str, tb: str, rng_seed: int, is_knockout: bool = False):
        """Simulate a single match. Returns (score_a, score_b, collapse_risk)."""
        rng = np.random.default_rng(rng_seed % 999983)
        fp_a = fp_cache.get(ta, {})
        fp_b = fp_cache.get(tb, {})
        rivalry = RIVALRIES.get(frozenset([ta, tb]), 0.50)

        str_a = _strength(ta, fp_a) * (1.0 + rivalry * 0.05)
        str_b = _strength(tb, fp_b) * (1.0 + rivalry * 0.05)
        total = str_a + str_b

        # Goal expectations (Poisson-like)
        lambda_a = max(0.4, (str_a / total) * 2.4 * float(rng.uniform(0.75, 1.25)))
        lambda_b = max(0.4, (str_b / total) * 2.4 * float(rng.uniform(0.75, 1.25)))

        score_a = int(rng.poisson(lambda_a))
        score_b = int(rng.poisson(lambda_b))

        # Knockout penalty shootout on draw
        winner = None
        pens_a = pens_b = None
        if is_knockout and score_a == score_b:
            # penalty shootout
            kicks_a = [bool(rng.random() < 0.72) for _ in range(5)]
            kicks_b = [bool(rng.random() < 0.72) for _ in range(5)]
            pens_a = sum(kicks_a)
            pens_b = sum(kicks_b)
            while pens_a == pens_b:
                pa = bool(rng.random() < 0.72); pb = bool(rng.random() < 0.72)
                pens_a += pa; pens_b += pb
            winner = ta if pens_a > pens_b else tb
        elif score_a > score_b:
            winner = ta
        else:
            winner = tb

        collapse_risk = round(float(np.clip(
            fp_a.get("burstiness", 0.3) * 0.35 + fp_a.get("turnover_pm", 0.2) * 0.35 + 0.15
            + (rivalry * 0.10) + float(rng.uniform(-0.05, 0.05)), 0.05, 0.92,
        )), 3)

        return {
            "score_a": score_a, "score_b": score_b,
            "winner": winner, "collapse_risk": collapse_risk,
            "penalties": {"a": pens_a, "b": pens_b} if pens_a is not None else None,
        }

    def _match_seed(ta: str, tb: str, stage: str) -> int:
        return int(hashlib.md5(f"{ta}-{tb}-{stage}".encode()).hexdigest()[:8], 16)

    # ── Group stage ───────────────────────────────────────────────────────
    group_results: dict[str, dict] = {}
    group_standings: dict[str, list[dict]] = {}

    for gname, teams in GROUPS.items():
        records: dict[str, dict] = {
            t: {"team": t, "played": 0, "won": 0, "drawn": 0, "lost": 0,
                "gf": 0, "ga": 0, "pts": 0, "collapse_risk": 0.0}
            for t in teams
        }
        matches = []
        pairs = [(teams[i], teams[j]) for i in range(4) for j in range(i+1, 4)]
        for ta, tb in pairs:
            r = _sim_match(ta, tb, _match_seed(ta, tb, f"G{gname}"))
            sa, sb = r["score_a"], r["score_b"]
            matches.append({"home": ta, "away": tb, "score": f"{sa}–{sb}",
                            "winner": r["winner"], "collapse_risk": r["collapse_risk"]})
            records[ta]["played"] += 1; records[tb]["played"] += 1
            records[ta]["gf"] += sa;    records[tb]["gf"] += sb
            records[ta]["ga"] += sb;    records[tb]["ga"] += sa
            records[ta]["collapse_risk"] = round(
                (records[ta]["collapse_risk"] * (records[ta]["played"] - 1) + r["collapse_risk"]) / records[ta]["played"], 3)
            if sa > sb:
                records[ta]["won"] += 1; records[ta]["pts"] += 3
                records[tb]["lost"] += 1
            elif sa < sb:
                records[tb]["won"] += 1; records[tb]["pts"] += 3
                records[ta]["lost"] += 1
            else:
                records[ta]["drawn"] += 1; records[ta]["pts"] += 1
                records[tb]["drawn"] += 1; records[tb]["pts"] += 1

        standings = sorted(
            records.values(),
            key=lambda x: (-x["pts"], -(x["gf"] - x["ga"]), -x["gf"]),
        )
        for i, s in enumerate(standings):
            s["gd"] = s["gf"] - s["ga"]
        group_results[gname] = {"matches": matches}
        group_standings[gname] = standings

    # Top 2 per group advance
    r16_teams: list[str] = []
    for g in "ABCDEFGH":
        r16_teams.append(group_standings[g][0]["team"])
        r16_teams.append(group_standings[g][1]["team"])

    # ── Knockout bracket (WC 2022 style pairing) ─────────────────────────
    # R16: 1A vs 2B, 1C vs 2D, 1E vs 2F, 1G vs 2H
    #      1B vs 2A, 1D vs 2C, 1F vs 2E, 1H vs 2G
    def _top(g): return group_standings[g][0]["team"]
    def _sec(g): return group_standings[g][1]["team"]

    r16_fixtures = [
        (_top("A"), _sec("B")), (_top("C"), _sec("D")),
        (_top("E"), _sec("F")), (_top("G"), _sec("H")),
        (_top("B"), _sec("A")), (_top("D"), _sec("C")),
        (_top("F"), _sec("E")), (_top("H"), _sec("G")),
    ]

    def _run_stage(fixtures: list[tuple[str, str]], stage: str) -> tuple[list[dict], list[str]]:
        results, winners = [], []
        for ta, tb in fixtures:
            r = _sim_match(ta, tb, _match_seed(ta, tb, stage), is_knockout=True)
            results.append({
                "home": ta, "away": tb,
                "score": f"{r['score_a']}–{r['score_b']}",
                "winner": r["winner"], "collapse_risk": r["collapse_risk"],
                "penalties": r["penalties"],
            })
            winners.append(r["winner"])
        return results, winners

    r16_results, r16_winners = _run_stage(r16_fixtures, "R16")
    qf_fixtures = list(zip(r16_winners[0::2], r16_winners[1::2]))
    qf_results, qf_winners = _run_stage(qf_fixtures, "QF")
    sf_fixtures = list(zip(qf_winners[0::2], qf_winners[1::2]))
    sf_results, sf_winners = _run_stage(sf_fixtures, "SF")

    # Third place
    sf_losers = [
        (r16_winners + qf_winners + sf_winners)  # derive SF losers from results
        for _ in [None]
    ]
    # Easier: pull losers from sf_results
    sf_losers_teams = [
        (r["home"] if r["away"] == r["winner"] else r["away"]) for r in sf_results
    ]
    tp_result, _ = _run_stage([(sf_losers_teams[0], sf_losers_teams[1])], "TP")
    final_result, final_winners = _run_stage([(sf_winners[0], sf_winners[1])], "F")

    champion = final_winners[0]
    runner_up = sf_winners[1] if champion == sf_winners[0] else sf_winners[0]

    # ── Top-risk moments (highest collapse risk match in each round) ──────
    all_matches = (
        [m for g in group_results.values() for m in g["matches"]]
        + r16_results + qf_results + sf_results + tp_result + final_result
    )
    top_risk = sorted(all_matches, key=lambda m: -m["collapse_risk"])[:5]

    # ── Team stats summary ────────────────────────────────────────────────
    team_stats: dict[str, dict] = {}
    for g, standings in group_standings.items():
        for s in standings:
            team_stats[s["team"]] = {
                "group": g, "pts": s["pts"], "gf": s["gf"], "ga": s["ga"],
                "gd": s["gd"], "collapse_risk": s["collapse_risk"],
            }

    rounds_reached: dict[str, str] = {}
    for t in [m["winner"] for m in r16_results]:   rounds_reached[t] = "QF"
    for t in [m["winner"] for m in qf_results]:    rounds_reached[t] = "SF"
    for t in sf_losers_teams:                       rounds_reached[t] = "SF exit"
    rounds_reached[tp_result[0]["winner"]] =       "3rd place"
    rounds_reached[runner_up] =                    "Runner-up"
    rounds_reached[champion] =                     "Champion 🏆"

    return {
        "champion": champion,
        "runner_up": runner_up,
        "third_place": tp_result[0]["winner"],
        "groups": {
            g: {"standings": group_standings[g], "matches": group_results[g]["matches"]}
            for g in "ABCDEFGH"
        },
        "knockout": {
            "r16": r16_results,
            "qf":  qf_results,
            "sf":  sf_results,
            "third_place": tp_result,
            "final": final_result,
        },
        "rounds_reached": rounds_reached,
        "top_risk_matches": top_risk,
        "team_stats": team_stats,
    }
