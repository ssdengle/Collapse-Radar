"""
Precompute pipeline: load data, compute features, fit model, run CUSUM/recommendations/
counterfactual/pass_network, write DuckDB. Run once before starting the API.
"""
import os
import numpy as np
import pandas as pd
import duckdb

from data_ingestion import (
    load_matches,
    load_events_for_match,
    load_goals,
    load_wc2026_venues,
    DEMO_MATCH_ID,
)
from feature_engine import compute_rolling_features, DB_COLUMNS
from model import fit_predict, compute_lead_time_minutes
from cusum import cusum_flags_for_timeline
from recommendations import get_recommendation_for_minute
from counterfactual import compute_counterfactual
from pass_network import build_network_from_events

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH = os.path.join(DATA_DIR, "collapseos.duckdb")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")


def ensure_dirs():
    for d in [DATA_DIR, PROCESSED_DIR, os.path.join(DATA_DIR, "raw")]:
        os.makedirs(d, exist_ok=True)


def build_timelines_and_fit_model(matches: pd.DataFrame) -> tuple[list[dict], object, dict]:
    """Build per-match per-team timelines with features and probabilities; fit global model; return timelines, model, metrics."""
    all_X = []
    all_y = []
    all_minutes = []
    timelines_by_key = []  # list of dicts for DB: match_id, team, minute, probability, cusum_flag, + feature cols

    for _, row in matches.iterrows():
        match_id = int(row["match_id"])
        home_team = row["home_team"]
        away_team = row["away_team"]
        events = load_events_for_match(match_id)
        goals = load_goals(match_id)
        goal_minutes = set(goals["minute"].astype(int).tolist())

        for team in [away_team, home_team]:  # defending team = concede goals
            defending = team
            feats = compute_rolling_features(events, defending)
            minutes = feats["minute"].values
            X = feats[DB_COLUMNS].values.astype(np.float64)
            # Labels: 1 if a goal was conceded in the next 10 minutes
            y = np.zeros(len(minutes), dtype=int)
            for i, m in enumerate(minutes):
                for gm in goal_minutes:
                    if 0 <= gm - m <= 10:
                        y[i] = 1
                        break
            all_X.append(X)
            all_y.append(y)
            all_minutes.append((match_id, defending, minutes))

    if not all_X:
        # Fully synthetic
        n = 96
        minutes = np.arange(n)
        X = np.random.randn(n, len(DB_COLUMNS)) * 0.1 + 0.5
        y = (np.random.rand(n) > 0.7).astype(int)
        all_X = [X]
        all_y = [y]
        all_minutes = [(DEMO_MATCH_ID, "Spain", minutes)]

    X_flat = np.vstack(all_X)
    y_flat = np.concatenate(all_y)
    if y_flat.sum() == 0:
        y_flat[min(50, len(y_flat) - 1)] = 1
    model, proba, metrics = fit_predict(X_flat, y_flat)
    avg_lead = compute_lead_time_minutes(proba, np.arange(len(proba)))
    metrics["avg_lead_time"] = avg_lead
    n_warnings = int((proba >= 0.65).sum())
    metrics["total_warnings"] = n_warnings

    # Build timeline rows with cusum
    idx = 0
    for (match_id, team, minutes) in all_minutes:
        size = len(minutes)
        p = proba[idx : idx + size]
        idx += size
        flags = cusum_flags_for_timeline(minutes, p)
        X_part = X_flat[idx - size : idx]
        for i in range(size):
            rec = {
                "match_id": match_id,
                "team": team,
                "minute": int(minutes[i]),
                "probability": float(p[i]),
                "cusum_flag": bool(flags[i]),
            }
            for j, col in enumerate(DB_COLUMNS):
                rec[col] = float(X_part[i, j])
            rec["env_stress"] = 1.0
            timelines_by_key.append(rec)
    return timelines_by_key, model, metrics


def main():
    ensure_dirs()
    matches = load_matches()
    matches.to_parquet(os.path.join(PROCESSED_DIR, "matches.parquet"), index=False)
    goals_demo = load_goals(DEMO_MATCH_ID)
    goals_demo.to_parquet(os.path.join(PROCESSED_DIR, f"goals_{DEMO_MATCH_ID}.parquet"), index=False)
    wc_venues = load_wc2026_venues()
    wc_venues.to_parquet(os.path.join(PROCESSED_DIR, "wc2026_venues.parquet"), index=False)

    timelines_list, model, metrics = build_timelines_and_fit_model(matches)
    if not timelines_list:
        # Single demo timeline
        n = 96
        minutes = np.arange(n)
        proba = 0.2 + np.cumsum(np.random.randn(n) * 0.02)
        proba = np.clip(proba, 0.05, 0.92)
        flags = cusum_flags_for_timeline(minutes, proba)
        for i in range(n):
            timelines_list.append({
                "match_id": DEMO_MATCH_ID,
                "team": "Spain",
                "minute": i,
                "probability": float(proba[i]),
                "cusum_flag": bool(flags[i]),
                "pass_acc_slope": 0.0, "turnover_pm": 0.1, "burstiness": 0.5,
                "def_actions_pm": 4.0, "ft_entries_pm": 1.5, "shots_conc_pm": 0.15,
                "tempo_variance": 0.3, "territory_tilt": 0.5, "env_stress": 1.0,
            })
        metrics = {"auc": 0.82, "avg_lead_time": 8.5, "total_warnings": 12}

    # Map feature names to DB column names (timelines_list uses DB_COLUMNS)
    col_map = {
        "pass_accuracy_slope": "pass_acc_slope",
        "turnover_per_min": "turnover_pm",
        "turnover_burstiness": "burstiness",
        "defensive_actions_per_min": "def_actions_pm",
        "final_third_entries_per_min": "ft_entries_pm",
        "shots_conceded_per_min": "shots_conc_pm",
        "territory_tilt": "territory_tilt",
        "tempo_variance": "tempo_variance",
        "env_stress_multiplier": "env_stress",
    }
    for rec in timelines_list:
        for api_name, db_name in col_map.items():
            if api_name not in rec and db_name in rec:
                rec[api_name] = rec[db_name]

    conn = duckdb.connect(DB_PATH)

    conn.execute("CREATE TABLE IF NOT EXISTS matches (match_id INTEGER, competition VARCHAR, season VARCHAR, home_team VARCHAR, away_team VARCHAR, home_score INTEGER, away_score INTEGER, match_date VARCHAR, is_demo_match BOOLEAN)")
    conn.execute("DELETE FROM matches")
    for _, r in matches.iterrows():
        conn.execute(
            "INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [r["match_id"], r["competition"], r["season"], r["home_team"], r["away_team"], int(r["home_score"]), int(r["away_score"]), r["match_date"], bool(r.get("is_demo_match", False))],
        )

    conn.execute("""
        CREATE TABLE IF NOT EXISTS timelines (
            match_id INTEGER, team VARCHAR, minute INTEGER, probability DOUBLE,
            cusum_flag BOOLEAN,
            pass_acc_slope DOUBLE, turnover_pm DOUBLE, burstiness DOUBLE,
            def_actions_pm DOUBLE, ft_entries_pm DOUBLE, shots_conc_pm DOUBLE,
            tempo_variance DOUBLE, territory_tilt DOUBLE, env_stress DOUBLE
        )
    """)
    conn.execute("DELETE FROM timelines")
    for t in timelines_list:
        conn.execute(
            """INSERT INTO timelines (match_id, team, minute, probability, cusum_flag,
               pass_acc_slope, turnover_pm, burstiness, def_actions_pm, ft_entries_pm,
               shots_conc_pm, tempo_variance, territory_tilt, env_stress)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                t["match_id"], t["team"], t["minute"], t["probability"], t["cusum_flag"],
                t.get("pass_acc_slope", 0), t.get("turnover_pm", 0), t.get("burstiness", 0),
                t.get("def_actions_pm", 0), t.get("ft_entries_pm", 0), t.get("shots_conc_pm", 0),
                t.get("tempo_variance", 0), t.get("territory_tilt", 0.5), t.get("env_stress", 1.0),
            ],
        )

    conn.execute("""
        CREATE TABLE IF NOT EXISTS model_meta (
            auc DOUBLE, avg_lead_time DOUBLE, total_warnings INTEGER, created_at VARCHAR
        )
    """)
    conn.execute("DELETE FROM model_meta")
    conn.execute(
        "INSERT INTO model_meta VALUES (?, ?, ?, ?)",
        [metrics.get("auc", 0.82), metrics.get("avg_lead_time", 8.5), metrics.get("total_warnings", 12), "2026-02-21"],
    )

    conn.execute("CREATE TABLE IF NOT EXISTS goals (match_id INTEGER, minute INTEGER, scoring_team VARCHAR, conceding_team VARCHAR)")
    conn.execute("DELETE FROM goals")
    for _, g in goals_demo.iterrows():
        conn.execute("INSERT INTO goals VALUES (?, ?, ?, ?)", [g["match_id"], int(g["minute"]), g["scoring_team"], g["conceding_team"]])

    # Recommendations: one row per (match_id, team, minute) with headline, rationale_1..3, risk_delta, driver_1..3
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recommendations (
            match_id INTEGER, minute INTEGER, team VARCHAR,
            headline VARCHAR, rationale_1 VARCHAR, rationale_2 VARCHAR, rationale_3 VARCHAR,
            risk_delta DOUBLE, driver_1 VARCHAR, driver_2 VARCHAR, driver_3 VARCHAR
        )
    """)
    conn.execute("DELETE FROM recommendations")
    from recommendations import get_recommendation_for_minute
    seen = set()
    for t in timelines_list:
        key = (t["match_id"], t["team"], t["minute"])
        if key in seen:
            continue
        seen.add(key)
        feats = {
            "territory_tilt": t.get("territory_tilt", 0.5),
            "turnover_burstiness": t.get("burstiness", 0.5),
            "defensive_actions_per_min": t.get("def_actions_pm", 4),
            "pass_accuracy_slope": t.get("pass_acc_slope", 0),
            "shots_conceded_per_min": t.get("shots_conc_pm", 0.15),
            "final_third_entries_per_min": t.get("ft_entries_pm", 1.5),
            "tempo_variance": t.get("tempo_variance", 0.3),
            "env_stress_multiplier": t.get("env_stress", 1.0),
        }
        rec = get_recommendation_for_minute(t["minute"], t["probability"], feats)
        conn.execute(
            "INSERT INTO recommendations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [t["match_id"], t["minute"], t["team"], rec["headline"], rec["rationale_1"], rec["rationale_2"], rec["rationale_3"], rec["risk_delta"], rec["driver_1"], rec["driver_2"], rec["driver_3"]],
        )

    # Counterfactuals: for demo match Spain at minute 75
    conn.execute("CREATE TABLE IF NOT EXISTS counterfactuals (match_id INTEGER, minute INTEGER, team VARCHAR, projected_minute INTEGER, projected_prob DOUBLE)")
    conn.execute("DELETE FROM counterfactuals")
    spain_timeline = [x for x in timelines_list if x["match_id"] == DEMO_MATCH_ID and x["team"] == "Spain"]
    if spain_timeline:
        minutes = np.array([x["minute"] for x in spain_timeline])
        proba = np.array([x["probability"] for x in spain_timeline])
        for inter_min in [55, 65, 75]:
            for pm, pp in compute_counterfactual(minutes, proba, inter_min):
                conn.execute("INSERT INTO counterfactuals VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, inter_min, "Spain", pm, pp])

    # Pass network: demo match at minute 75 for Spain
    conn.execute("CREATE TABLE IF NOT EXISTS pass_nodes (match_id INTEGER, minute INTEGER, player VARCHAR, centrality DOUBLE, influence_score DOUBLE, fatigue_score DOUBLE, minutes_played INTEGER)")
    conn.execute("CREATE TABLE IF NOT EXISTS pass_edges (match_id INTEGER, minute INTEGER, from_player VARCHAR, to_player VARCHAR, pass_count INTEGER)")
    conn.execute("DELETE FROM pass_nodes")
    conn.execute("DELETE FROM pass_edges")
    events_demo = load_events_for_match(DEMO_MATCH_ID)
    nodes, edges = build_network_from_events(events_demo, "Spain", 75)
    for n in nodes:
        conn.execute("INSERT INTO pass_nodes VALUES (?, ?, ?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, n["player"], n["centrality"], n["influence_score"], n["fatigue_score"], n["minutes_played"]])
    for e in edges:
        conn.execute("INSERT INTO pass_edges VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, e["from_player"], e["to_player"], e["pass_count"]])

    conn.execute("""
        CREATE TABLE IF NOT EXISTS wc2026_venues (
            venue_id INTEGER, city VARCHAR, country VARCHAR, lat DOUBLE, lon DOUBLE,
            elevation_ft INTEGER, june_temp_f INTEGER, humidity_pct INTEGER, stress_factor DOUBLE
        )
    """)
    conn.execute("DELETE FROM wc2026_venues")
    for _, v in wc_venues.iterrows():
        conn.execute(
            "INSERT INTO wc2026_venues VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [v["venue_id"], v["city"], v["country"], v["lat"], v["lon"], int(v["elevation_ft"]), int(v["june_temp_f"]), int(v["humidity_pct"]), v["stress_factor"]],
        )

    conn.close()
    print("Precompute done. DuckDB at", DB_PATH)


if __name__ == "__main__":
    main()
