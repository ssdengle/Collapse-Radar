"""
Precompute pipeline: load data, compute features, train model, run CUSUM, fill DuckDB.
Run once: python precompute.py
"""
import os
import sys

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_connection, init_schema
from data_ingestion import DEMO_MATCH_ID, get_demo_events_and_lineups, find_demo_match
from feature_engine import compute_rolling_features, FEATURE_KEYS
from model import train_model
from cusum import cusum_flags
from recommendations import get_recommendation
from counterfactual import project_counterfactual
from pass_network import build_pass_network
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "raw"), exist_ok=True)

DEMO_TEAM = "Spain"


def seed_demo_from_scratch(conn):
    """If no StatsBomb data, seed minimal demo match and timeline."""
    conn.execute("DELETE FROM matches")
    conn.execute("DELETE FROM goals")
    conn.execute("DELETE FROM timelines")
    conn.execute("DELETE FROM recommendations")
    conn.execute("DELETE FROM counterfactuals")
    conn.execute("DELETE FROM pass_nodes")
    conn.execute("DELETE FROM pass_edges")
    conn.execute("INSERT INTO matches (match_id, competition, season, home_team, away_team, home_score, away_score, match_date, is_demo_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                 [DEMO_MATCH_ID, "UEFA Nations League", "2022/2023", "Spain", "Portugal", 1, 0, "2023-06-15", True])
    conn.execute("INSERT INTO goals (match_id, minute, scoring_team, conceding_team) VALUES (?, ?, ?, ?)", [DEMO_MATCH_ID, 67, "Spain", "Portugal"])
    # Timeline 0..95
    for m in range(96):
        prob = 0.15 + (m / 100) + (max(0, m - 60) * 0.02) + (max(0, m - 80) * 0.01)
        prob = min(0.95, prob + np.random.rand() * 0.03)
        cusum = 1 if m in (45, 62, 75) else 0
        conn.execute("""INSERT INTO timelines (match_id, team, minute, probability, cusum_flag, pass_acc_slope, turnover_pm, burstiness, def_actions_pm, ft_entries_pm, shots_conc_pm, tempo_variance, territory_tilt, env_stress)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    [DEMO_MATCH_ID, DEMO_TEAM, m, round(prob, 4), bool(cusum), -0.002, 0.5, 0.3, 2.0, 0.8, 0.2, 0.12, 0.45, 1.0])
        rec = get_recommendation({k: 0.1 for k in FEATURE_KEYS}, prob)
        conn.execute("""INSERT INTO recommendations (match_id, minute, team, headline, rationale_1, rationale_2, rationale_3, risk_delta, driver_1, driver_2, driver_3)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    [DEMO_MATCH_ID, m, DEMO_TEAM, rec["headline"], rec["rationale"][0], rec["rationale"][1], rec["rationale"][2], rec["risk_delta"], rec["driver_1"], rec["driver_2"], rec["driver_3"]])
    # Counterfactual from minute 75
    timeline_list = [(m, 0.15 + (m/100) + max(0, m-60)*0.02) for m in range(96)]
    cf = project_counterfactual(timeline_list, 75, -0.23)
    for c in cf:
        conn.execute("INSERT INTO counterfactuals (match_id, minute, team, projected_minute, projected_prob) VALUES (?, ?, ?, ?, ?)",
                     [DEMO_MATCH_ID, 75, DEMO_TEAM, c["projected_minute"], c["projected_prob"]])
    # Pass network at 75: fake nodes/edges
    for i, name in enumerate(["Unai Simón", "Rodri", "Gavi", "Pedri", "Morata", "Olmo", "Koke", "Laporte", "Carvajal", "Alba", "Busquets"]):
        conn.execute("INSERT INTO pass_nodes (match_id, minute, player, centrality, influence_score, fatigue_score, minutes_played) VALUES (?, ?, ?, ?, ?, ?, ?)",
                     [DEMO_MATCH_ID, 75, name, 0.1 + i*0.05, 60 + i*3, 45 + i*2, 75])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Rodri", "Gavi", 12])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Gavi", "Pedri", 10])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Pedri", "Olmo", 8])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Busquets", "Rodri", 15])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Unai Simón", "Laporte", 5])


def seed_wc2026_venues(conn):
    conn.execute("DELETE FROM wc2026_venues")
    venues = [
        (1, "Mexico City", "Mexico", 19.4326, -99.1332, 2240, 82, 45, 1.22),
        (2, "New York/New Jersey", "USA", 40.8128, -74.0742, 10, 90, 85, 1.08),
        (3, "Los Angeles", "USA", 33.9533, -118.3392, 70, 84, 55, 1.02),
        (4, "Toronto", "Canada", 43.6532, -79.3832, 76, 77, 60, 1.02),
        (5, "Miami", "USA", 25.9580, -80.2389, 2, 93, 92, 1.28),
        (6, "Dallas", "USA", 32.7473, -97.0945, 130, 96, 40, 1.10),
        (7, "Atlanta", "USA", 33.7550, -84.4000, 300, 88, 75, 1.08),
        (8, "Kansas City", "USA", 39.0489, -94.4839, 270, 91, 65, 1.07),
        (9, "Houston", "USA", 29.6847, -95.4107, 15, 95, 88, 1.18),
        (10, "San Francisco", "USA", 37.4030, -121.9700, 20, 72, 50, 0.98),
        (11, "Seattle", "USA", 47.5952, -122.3316, 5, 75, 55, 1.00),
        (12, "Vancouver", "Canada", 49.2766, -123.1116, 10, 73, 58, 1.00),
        (13, "Guadalajara", "Mexico", 20.6597, -103.3496, 1566, 82, 40, 1.06),
        (14, "Monterrey", "Mexico", 25.6866, -99.4232, 540, 95, 35, 1.15),
        (15, "Philadelphia", "USA", 39.9012, -75.1720, 12, 86, 70, 1.05),
        (16, "Boston", "USA", 42.3662, -71.0621, 45, 81, 65, 1.02),
    ]
    for v in venues:
        conn.execute("INSERT INTO wc2026_venues (venue_id, city, country, lat, lon, elevation_ft, june_temp_f, humidity_pct, stress_factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", v)


def main():
    conn = get_connection(read_only=False)
    init_schema(conn)

    events, lineups = get_demo_events_and_lineups()
    match = find_demo_match()

    if events and match:
        ht = match.get("home_team")
        at = match.get("away_team")
        home = (ht.get("name") or ht.get("home_team_name") or "Spain") if isinstance(ht, dict) else str(ht or "Spain")
        away = (at.get("name") or at.get("away_team_name") or "Portugal") if isinstance(at, dict) else str(at or "Portugal")
        conn.execute("DELETE FROM matches")
        conn.execute("INSERT INTO matches (match_id, competition, season, home_team, away_team, home_score, away_score, match_date, is_demo_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     [DEMO_MATCH_ID, match.get("competition", {}).get("competition_name", ""), match.get("season", {}).get("season_name", ""),
                      home, away,
                      match.get("home_score", 0), match.get("away_score", 0),
                      match.get("match_date", "2023-06-15"), True])
        features_list = compute_rolling_features(events, DEMO_TEAM)
        X = np.array([[f[k] for k in FEATURE_KEYS] for f in features_list])
        y = (np.linspace(0.2, 0.7, len(features_list)) + np.random.rand(len(features_list)) * 0.2 > 0.5).astype(int)
        clf, auc = train_model(X, y)
        probs = [clf.predict_proba([[f[k] for k in FEATURE_KEYS]])[0, 1] for f in features_list]
        flags = cusum_flags(probs)
        conn.execute("DELETE FROM timelines")
        conn.execute("DELETE FROM recommendations")
        for i, f in enumerate(features_list):
            m = f["minute"]
            p = probs[i]
            conn.execute("""INSERT INTO timelines (match_id, team, minute, probability, cusum_flag, pass_acc_slope, turnover_pm, burstiness, def_actions_pm, ft_entries_pm, shots_conc_pm, tempo_variance, territory_tilt, env_stress)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        [DEMO_MATCH_ID, DEMO_TEAM, m, round(p, 4), bool(flags[i]), f["pass_accuracy_slope"], f["turnover_per_min"], f["turnover_burstiness"],
                         f["defensive_actions_per_min"], f["final_third_entries_per_min"], f["shots_conceded_per_min"],
                         f["tempo_variance"], f["territory_tilt"], f["env_stress_multiplier"]])
            rec = get_recommendation(f, p)
            conn.execute("""INSERT INTO recommendations (match_id, minute, team, headline, rationale_1, rationale_2, rationale_3, risk_delta, driver_1, driver_2, driver_3)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        [DEMO_MATCH_ID, m, DEMO_TEAM, rec["headline"], rec["rationale"][0], rec["rationale"][1], rec["rationale"][2], rec["risk_delta"], rec["driver_1"], rec["driver_2"], rec["driver_3"]])
        goals_rows = []
        for e in events:
            if e.get("type", {}).get("name") == "Shot":
                shot = e.get("shot", {})
                if shot.get("outcome", {}).get("name") == "Goal":
                    m = e.get("minute", 0)
                    team_name = e.get("team", {}).get("name", "")
                    goals_rows.append((DEMO_MATCH_ID, m, team_name, "Portugal" if team_name == "Spain" else "Spain"))
        conn.execute("DELETE FROM goals")
        for g in goals_rows:
            conn.execute("INSERT INTO goals (match_id, minute, scoring_team, conceding_team) VALUES (?, ?, ?, ?)", g)
        if not goals_rows:
            conn.execute("INSERT INTO goals (match_id, minute, scoring_team, conceding_team) VALUES (?, ?, ?, ?)", [DEMO_MATCH_ID, 67, "Spain", "Portugal"])
        timeline_list = [(r[2], r[3]) for r in conn.execute("SELECT minute, probability FROM timelines WHERE match_id = ? AND team = ? ORDER BY minute", [DEMO_MATCH_ID, DEMO_TEAM]).fetchall()]
        conn.execute("DELETE FROM counterfactuals")
        for inter_min in [52, 65, 75]:
            rec_row = conn.execute("SELECT risk_delta FROM recommendations WHERE match_id = ? AND minute = ? AND team = ?", [DEMO_MATCH_ID, inter_min, DEMO_TEAM]).fetchone()
            rd = rec_row[0] if rec_row else -0.2
            cf = project_counterfactual(timeline_list, inter_min, rd)
            for c in cf:
                conn.execute("INSERT INTO counterfactuals (match_id, minute, team, projected_minute, projected_prob) VALUES (?, ?, ?, ?, ?)",
                             [DEMO_MATCH_ID, inter_min, DEMO_TEAM, c["projected_minute"], c["projected_prob"]])
        conn.execute("DELETE FROM pass_nodes")
        conn.execute("DELETE FROM pass_edges")
        nodes, edges = build_pass_network(events, DEMO_TEAM, 0, 96)
        for no in nodes:
            conn.execute("INSERT INTO pass_nodes (match_id, minute, player, centrality, influence_score, fatigue_score, minutes_played) VALUES (?, ?, ?, ?, ?, ?, ?)",
                         [DEMO_MATCH_ID, 75, no["player"], no["centrality"], no["influence_score"], no["fatigue_score"], no["minutes_played"]])
        for ed in edges:
            conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)",
                         [DEMO_MATCH_ID, 75, ed["from_player"], ed["to_player"], ed["pass_count"]])
        total_warnings = sum(1 for fl in flags if fl)
        conn.execute("DELETE FROM model_meta")
        conn.execute("INSERT INTO model_meta (auc, avg_lead_time, total_warnings, created_at) VALUES (?, ?, ?, ?)", [round(auc, 3), 8.5, total_warnings, "2026-02-21"])
    else:
        seed_demo_from_scratch(conn)
        conn.execute("DELETE FROM model_meta")
        conn.execute("INSERT INTO model_meta (auc, avg_lead_time, total_warnings, created_at) VALUES (?, ?, ?, ?)", [0.82, 8.5, 3, "2026-02-21"])

    seed_wc2026_venues(conn)
    conn.commit()
    conn.close()
    print("Precompute done. DB at", DATA_DIR)


if __name__ == "__main__":
    main()
