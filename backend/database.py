"""
DuckDB schema and helpers for CollapseOS.
"""
import os
import duckdb

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
DB_PATH = os.path.join(DATA_DIR, "collapseos.duckdb")


def get_connection(read_only: bool = False):
    os.makedirs(DATA_DIR, exist_ok=True)
    return duckdb.connect(DB_PATH, read_only=read_only)


def get_db():
    """Read-only connection for API."""
    return get_connection(read_only=True)


def init_schema(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            match_id INTEGER PRIMARY KEY,
            competition VARCHAR,
            season VARCHAR,
            home_team VARCHAR,
            away_team VARCHAR,
            home_score INTEGER,
            away_score INTEGER,
            match_date VARCHAR,
            is_demo_match BOOLEAN
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            match_id INTEGER,
            minute INTEGER,
            scoring_team VARCHAR,
            conceding_team VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS timelines (
            match_id INTEGER,
            team VARCHAR,
            minute INTEGER,
            probability DOUBLE,
            cusum_flag BOOLEAN,
            pass_acc_slope DOUBLE,
            turnover_pm DOUBLE,
            burstiness DOUBLE,
            def_actions_pm DOUBLE,
            ft_entries_pm DOUBLE,
            shots_conc_pm DOUBLE,
            tempo_variance DOUBLE,
            territory_tilt DOUBLE,
            env_stress DOUBLE
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recommendations (
            match_id INTEGER,
            minute INTEGER,
            team VARCHAR,
            headline VARCHAR,
            rationale_1 VARCHAR,
            rationale_2 VARCHAR,
            rationale_3 VARCHAR,
            risk_delta DOUBLE,
            driver_1 VARCHAR,
            driver_2 VARCHAR,
            driver_3 VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS counterfactuals (
            match_id INTEGER,
            minute INTEGER,
            team VARCHAR,
            projected_minute INTEGER,
            projected_prob DOUBLE
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pass_nodes (
            match_id INTEGER,
            minute INTEGER,
            player VARCHAR,
            centrality DOUBLE,
            influence_score DOUBLE,
            fatigue_score DOUBLE,
            minutes_played INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pass_edges (
            match_id INTEGER,
            minute INTEGER,
            from_player VARCHAR,
            to_player VARCHAR,
            pass_count INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS model_meta (
            auc DOUBLE,
            avg_lead_time DOUBLE,
            total_warnings INTEGER,
            created_at VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS wc2026_venues (
            venue_id INTEGER PRIMARY KEY,
            city VARCHAR,
            country VARCHAR,
            lat DOUBLE,
            lon DOUBLE,
            elevation_ft INTEGER,
            june_temp_f INTEGER,
            humidity_pct INTEGER,
            stress_factor DOUBLE
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS timeline_features (
            match_id INTEGER,
            team VARCHAR,
            minute INTEGER,
            pass_accuracy_slope DOUBLE,
            turnover_per_min DOUBLE,
            turnover_burstiness DOUBLE,
            defensive_actions_per_min DOUBLE,
            final_third_entries_per_min DOUBLE,
            shots_conceded_per_min DOUBLE,
            tempo_variance DOUBLE,
            territory_tilt DOUBLE,
            env_stress_multiplier DOUBLE
        )
    """)


DEMO_MATCH_ID = 3943043
DEMO_TEAM = "Spain"


def seed_minimal(conn):
    """Seed minimal demo data so API works without running precompute.py."""
    conn.execute("DELETE FROM matches")
    conn.execute("DELETE FROM goals")
    conn.execute("DELETE FROM timelines")
    conn.execute("DELETE FROM recommendations")
    conn.execute("DELETE FROM counterfactuals")
    conn.execute("DELETE FROM pass_nodes")
    conn.execute("DELETE FROM pass_edges")
    conn.execute("DELETE FROM model_meta")
    conn.execute("DELETE FROM wc2026_venues")

    conn.execute(
        "INSERT INTO matches (match_id, competition, season, home_team, away_team, home_score, away_score, match_date, is_demo_match) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [DEMO_MATCH_ID, "UEFA Nations League", "2022/2023", "Spain", "Portugal", 1, 0, "2023-06-15", True],
    )
    conn.execute("INSERT INTO goals (match_id, minute, scoring_team, conceding_team) VALUES (?, ?, ?, ?)", [DEMO_MATCH_ID, 67, "Spain", "Portugal"])
    for m in range(96):
        prob = 0.15 + (m / 100) + (max(0, m - 60) * 0.02) + (max(0, m - 80) * 0.01)
        prob = min(0.95, prob)
        cusum = 1 if m in (45, 62, 75) else 0
        conn.execute(
            """INSERT INTO timelines (match_id, team, minute, probability, cusum_flag, pass_acc_slope, turnover_pm, burstiness, def_actions_pm, ft_entries_pm, shots_conc_pm, tempo_variance, territory_tilt, env_stress)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [DEMO_MATCH_ID, DEMO_TEAM, m, round(prob, 4), bool(cusum), -0.002, 0.5, 0.3, 2.0, 0.8, 0.2, 0.12, 0.45, 1.0],
        )
        conn.execute(
            """INSERT INTO recommendations (match_id, minute, team, headline, rationale_1, rationale_2, rationale_3, risk_delta, driver_1, driver_2, driver_3)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [DEMO_MATCH_ID, m, DEMO_TEAM, "Reduce central build-up immediately", "Increase defensive compactness in midfield", "Lower press intensity to preserve energy", "Reduce central build-up and protect flanks", -0.2, "territory_tilt", "turnover_burstiness", "defensive_actions_per_min"],
        )
    for m in range(75, 96):
        prob = 0.15 + (m / 100) + (max(0, m - 60) * 0.02)
        conn.execute("INSERT INTO counterfactuals (match_id, minute, team, projected_minute, projected_prob) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, DEMO_TEAM, m, round(max(0.05, prob - 0.23), 4)])
    for i, name in enumerate(["Unai Simón", "Rodri", "Gavi", "Pedri", "Morata", "Olmo", "Koke", "Laporte", "Carvajal", "Alba", "Busquets"]):
        conn.execute("INSERT INTO pass_nodes (match_id, minute, player, centrality, influence_score, fatigue_score, minutes_played) VALUES (?, ?, ?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, name, 0.1 + i * 0.05, 60 + i * 3, 45 + i * 2, 75])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Rodri", "Gavi", 12])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Gavi", "Pedri", 10])
    conn.execute("INSERT INTO pass_edges (match_id, minute, from_player, to_player, pass_count) VALUES (?, ?, ?, ?, ?)", [DEMO_MATCH_ID, 75, "Busquets", "Rodri", 15])
    conn.execute("INSERT INTO model_meta (auc, avg_lead_time, total_warnings, created_at) VALUES (?, ?, ?, ?)", [0.82, 8.5, 3, "2026-02-21"])
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


def ensure_db_ready():
    """Create schema and seed minimal data if DB is empty or missing. Call at app startup."""
    conn = get_connection(read_only=False)
    try:
        needs_seed = False
        try:
            row = conn.execute("SELECT 1 FROM matches LIMIT 1").fetchone()
            needs_seed = row is None
        except Exception:
            needs_seed = True
        if needs_seed:
            init_schema(conn)
            seed_minimal(conn)
            conn.commit()
    finally:
        conn.close()


def get_window_features(match_id: int, team: str, minute: int):
    """Return feature row for a given match/team/minute (for simulation)."""
    conn = get_connection(read_only=True)
    row = conn.execute(
        "SELECT probability FROM timelines WHERE match_id = ? AND team = ? AND minute = ?",
        [match_id, team, minute],
    ).fetchone()
    conn.close()
    return row[0] if row else 0.0


def recompute_probability_without_player(
    match_id: int, team: str, player: str, minute: int
):
    """
    Approximate new collapse probability if player were removed.
    Returns (original_prob, new_prob). Uses pass_nodes influence_score when present;
    otherwise uses a generic heuristic so UI (e.g. French squad names) still gets a sensible delta.
    """
    conn = get_connection(read_only=True)
    orig = conn.execute(
        "SELECT probability FROM timelines WHERE match_id = ? AND team = ? AND minute = ?",
        [match_id, team, minute],
    ).fetchone()
    orig_prob = float(orig[0]) if orig else 0.5

    node = conn.execute(
        "SELECT influence_score FROM pass_nodes WHERE match_id = ? AND minute = ? AND player = ?",
        [match_id, minute, player],
    ).fetchone()
    conn.close()

    # Use influence from pass network when available; else generic heuristic (e.g. 50) so any player shows a delta
    influence = float(node[0]) if node else 50.0
    delta = min(0.25, influence * 0.015)
    new_prob = min(0.95, orig_prob + delta)
    return orig_prob, new_prob
