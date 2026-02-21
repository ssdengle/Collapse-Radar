"""
Seed a minimal DuckDB for the CollapseOS API so the frontend works without running the full precompute pipeline.
Loads all matches from StatsBomb open data (data/raw/statsbomb/matches/) if present, so the dropdown shows many matches.
Run: python seed_demo_db.py
"""
import json
import os
import duckdb

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH = os.path.join(DATA_DIR, "collapseos.duckdb")
STATSBOMB_MATCHES_DIR = os.path.join(DATA_DIR, "raw", "statsbomb", "matches")
DEMO_MATCH_ID = 3943043

os.makedirs(DATA_DIR, exist_ok=True)

conn = duckdb.connect(DB_PATH)

# matches: load from StatsBomb open data if available, then ensure demo match exists
conn.execute("""
    CREATE TABLE IF NOT EXISTS matches (
        match_id INTEGER, competition VARCHAR, season VARCHAR, home_team VARCHAR, away_team VARCHAR,
        home_score INTEGER, away_score INTEGER, match_date VARCHAR, is_demo_match BOOLEAN
    )
""")
conn.execute("DELETE FROM matches")

match_rows = []
if os.path.isdir(STATSBOMB_MATCHES_DIR):
    for comp_id in os.listdir(STATSBOMB_MATCHES_DIR):
        comp_path = os.path.join(STATSBOMB_MATCHES_DIR, comp_id)
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
                    comp = m.get("competition", {})
                    season = m.get("season", {})
                    home = m.get("home_team", {})
                    away = m.get("away_team", {})
                    match_id = m["match_id"]
                    match_rows.append((
                        match_id,
                        comp.get("competition_name", ""),
                        season.get("season_name", ""),
                        home.get("home_team_name", ""),
                        away.get("away_team_name", ""),
                        m.get("home_score", 0),
                        m.get("away_score", 0),
                        m.get("match_date", ""),
                        match_id == DEMO_MATCH_ID,
                    ))
            except Exception:
                continue

for row in match_rows:
    conn.execute(
        "INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row,
    )

# If no StatsBomb data (or empty), insert the single demo match
if not match_rows:
    conn.execute(
        "INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (DEMO_MATCH_ID, "FIFA World Cup", "2022", "France", "Argentina", 3, 3, "2022-12-18", True),
    )
else:
    # Ensure demo match exists for full timeline/stats (if not already in list)
    existing = conn.execute("SELECT 1 FROM matches WHERE match_id = ?", [DEMO_MATCH_ID]).fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (DEMO_MATCH_ID, "FIFA World Cup", "2022", "France", "Argentina", 3, 3, "2022-12-18", True),
        )

print(f"Inserted {len(match_rows) if match_rows else 1} match(es) into matches table.")

# model_meta
conn.execute("""
    CREATE TABLE IF NOT EXISTS model_meta (auc DOUBLE, avg_lead_time DOUBLE, total_warnings INTEGER, created_at VARCHAR)
""")
conn.execute("DELETE FROM model_meta")
conn.execute("INSERT INTO model_meta VALUES (0.82, 8.5, 12, '2026-02-21')")

# timelines
conn.execute("""
    CREATE TABLE IF NOT EXISTS timelines (
        match_id INTEGER, team VARCHAR, minute INTEGER, probability DOUBLE, cusum_flag BOOLEAN,
        pass_acc_slope DOUBLE, turnover_pm DOUBLE, burstiness DOUBLE, def_actions_pm DOUBLE,
        ft_entries_pm DOUBLE, shots_conc_pm DOUBLE, tempo_variance DOUBLE, territory_tilt DOUBLE, env_stress DOUBLE
    )
""")
conn.execute("DELETE FROM timelines")
for i in range(96):
    p = min(0.92, max(0.05, 0.2 + i * 0.006 + (0.1 if i > 60 else 0)))
    cusum = 1 if i in (25, 50, 75) else 0
    conn.execute(
        "INSERT INTO timelines VALUES (3943043, 'Spain', ?, ?, ?, 0, 0.1, 0.5, 4, 1.5, 0.15, 0.3, 0.5, 1.0)",
        [i, p, bool(cusum)],
    )

# goals
conn.execute("""
    CREATE TABLE IF NOT EXISTS goals (match_id INTEGER, minute INTEGER, scoring_team VARCHAR, conceding_team VARCHAR)
""")
conn.execute("DELETE FROM goals")
for m, sc, co in [
    (23, "Argentina", "France"),
    (36, "France", "Argentina"),
    (67, "Argentina", "France"),
    (80, "France", "Argentina"),
    (88, "Argentina", "France"),
]:
    conn.execute("INSERT INTO goals VALUES (3943043, ?, ?, ?)", [m, sc, co])

# recommendations
conn.execute("""
    CREATE TABLE IF NOT EXISTS recommendations (
        match_id INTEGER, minute INTEGER, team VARCHAR, headline VARCHAR,
        rationale_1 VARCHAR, rationale_2 VARCHAR, rationale_3 VARCHAR, risk_delta DOUBLE,
        driver_1 VARCHAR, driver_2 VARCHAR, driver_3 VARCHAR
    )
""")
conn.execute("DELETE FROM recommendations")
for i in range(96):
    conn.execute(
        "INSERT INTO recommendations VALUES (3943043, ?, 'Spain', ?, ?, ?, ?, -0.25, ?, ?, ?)",
        [
            i,
            "Reduce central build-up",
            "Increase compactness",
            "Lower press",
            "Slow build-up",
            "territory_tilt",
            "turnover_burstiness",
            "defensive_actions_per_min",
        ],
    )

# counterfactuals
conn.execute("""
    CREATE TABLE IF NOT EXISTS counterfactuals (
        match_id INTEGER, minute INTEGER, team VARCHAR, projected_minute INTEGER, projected_prob DOUBLE
    )
""")
conn.execute("DELETE FROM counterfactuals")
for inter in [55, 65, 75]:
    for proj_min in range(inter, 96):
        conn.execute(
            "INSERT INTO counterfactuals VALUES (3943043, ?, 'Spain', ?, ?)",
            [inter, proj_min, max(0.05, 0.5 - (proj_min - inter) * 0.01)],
        )

# pass_nodes / pass_edges
conn.execute("""
    CREATE TABLE IF NOT EXISTS pass_nodes (
        match_id INTEGER, minute INTEGER, player VARCHAR, centrality DOUBLE,
        influence_score DOUBLE, fatigue_score DOUBLE, minutes_played INTEGER
    )
""")
conn.execute("""
    CREATE TABLE IF NOT EXISTS pass_edges (
        match_id INTEGER, minute INTEGER, from_player VARCHAR, to_player VARCHAR, pass_count INTEGER
    )
""")
conn.execute("DELETE FROM pass_nodes")
conn.execute("DELETE FROM pass_edges")
for name, inf, fat in [
    ("Busquets", 0.9, 0.88),
    ("Rodri", 0.85, 0.82),
    ("Pedri", 0.92, 0.75),
    ("Gavi", 0.78, 0.9),
    ("Olmo", 0.7, 0.72),
    ("Alba", 0.65, 0.85),
    ("Laporte", 0.8, 0.9),
    ("Torres", 0.72, 0.68),
    ("Morata", 0.65, 0.7),
    ("Williams", 0.68, 0.65),
]:
    conn.execute("INSERT INTO pass_nodes VALUES (3943043, 75, ?, 0.3, ?, ?, 75)", [name, inf, fat])
for a, b, v in [
    ("Busquets", "Rodri", 12),
    ("Rodri", "Pedri", 15),
    ("Pedri", "Gavi", 10),
    ("Gavi", "Olmo", 8),
    ("Alba", "Pedri", 7),
    ("Laporte", "Rodri", 9),
]:
    conn.execute("INSERT INTO pass_edges VALUES (3943043, 75, ?, ?, ?)", [a, b, v])

# wc2026_venues
conn.execute("""
    CREATE TABLE IF NOT EXISTS wc2026_venues (
        venue_id INTEGER, city VARCHAR, country VARCHAR, lat DOUBLE, lon DOUBLE,
        elevation_ft INTEGER, june_temp_f INTEGER, humidity_pct INTEGER, stress_factor DOUBLE
    )
""")
conn.execute("DELETE FROM wc2026_venues")
for v in [
    # (venue_id, city, country, lat, lon, elevation_ft, june_temp_f, humidity_pct, stress_factor)
    ( 1, "Mexico City",        "Mexico",  19.3029, -99.1505,  7382,  72, 60, 1.18),
    ( 2, "Guadalajara",        "Mexico",  20.6898,-103.4599,  5141,  78, 45, 1.15),
    ( 3, "Monterrey",          "Mexico",  25.6694,-100.2360,  1765,  91, 52, 1.19),
    ( 4, "Dallas",             "USA",     32.7480, -97.0928,   580,  90, 50, 1.12),
    ( 5, "Houston",            "USA",     29.6847, -95.4107,    80,  90, 70, 1.16),
    ( 6, "Miami",              "USA",     25.9580, -80.2390,     8,  88, 75, 1.22),
    ( 7, "Atlanta",            "USA",     33.7554, -84.4008,  1050,  83, 65, 1.08),
    ( 8, "Philadelphia",       "USA",     39.9008, -75.1675,    39,  79, 60, 1.03),
    ( 9, "New York/New Jersey","USA",     40.8136, -74.0745,     5,  78, 65, 1.02),
    (10, "Boston",             "USA",     42.0909, -71.2643,   200,  72, 55, 0.97),
    (11, "Kansas City",        "USA",     39.0489, -94.4839,   909,  83, 60, 1.06),
    (12, "Los Angeles",        "USA",     33.9535,-118.3392,    82,  75, 55, 0.98),
    (13, "San Francisco",      "USA",     37.4033,-121.9694,    30,  66, 55, 0.95),
    (14, "Seattle",            "USA",     47.5952,-122.3316,   177,  68, 60, 0.94),
    (15, "Vancouver",          "Canada",  49.2768,-123.1118,   100,  66, 58, 0.93),
    (16, "Toronto",            "Canada",  43.6332, -79.4172,   249,  72, 58, 0.95),
]:
    conn.execute("INSERT INTO wc2026_venues VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", v)

conn.close()
print("Demo DB created at", DB_PATH)
