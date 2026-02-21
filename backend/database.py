"""DuckDB helpers and simulation helpers for CollapseOS."""
from __future__ import annotations
import os
import duckdb

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "collapseos.duckdb")


def get_connection(read_only: bool = True):
    return duckdb.connect(DB_PATH, read_only=read_only)


def get_window_features(match_id: int, team: str, minute: int) -> dict | None:
    """Return feature row for the given match/minute/team, or None."""
    conn = get_connection()
    row = conn.execute(
        """
        SELECT minute, probability, pass_acc_slope, turnover_pm, burstiness,
               def_actions_pm, ft_entries_pm, shots_conc_pm, tempo_variance,
               territory_tilt, env_stress
        FROM timelines
        WHERE match_id = ? AND team = ? AND minute = ?
        """,
        [match_id, team, minute],
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "minute": row[0],
        "probability": row[1],
        "pass_acc_slope": row[2],
        "turnover_pm": row[3],
        "burstiness": row[4],
        "def_actions_pm": row[5],
        "ft_entries_pm": row[6],
        "shots_conc_pm": row[7],
        "tempo_variance": row[8],
        "territory_tilt": row[9],
        "env_stress": row[10],
    }


def recompute_probability_without_player(
    match_id: int, team: str, player: str, minute: int
) -> tuple[float, float]:
    """
    Return (original_probability, new_probability) if the given player were removed.
    Uses a heuristic: new_prob = original + influence_weight (player removal increases risk).
    """
    conn = get_connection()
    orig = conn.execute(
        "SELECT probability FROM timelines WHERE match_id = ? AND team = ? AND minute = ?",
        [match_id, team, minute],
    ).fetchone()
    if not orig:
        conn.close()
        return 0.0, 0.0
    original_prob = float(orig[0])

    influence_row = conn.execute(
        """
        SELECT influence_score FROM pass_nodes
        WHERE match_id = ? AND minute = ? AND player = ?
        """,
        [match_id, minute, player],
    ).fetchone()
    conn.close()

    if not influence_row:
        return original_prob, original_prob
    influence = float(influence_row[0])
    # Heuristic: removing a high-influence player increases collapse risk
    delta = influence * 0.15
    new_prob = min(0.99, original_prob + delta)
    return original_prob, new_prob
