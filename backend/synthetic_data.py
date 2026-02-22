"""Generate deterministic synthetic data per match_id/team when DB has no precomputed data."""

HEADLINES = [
    "Reduce central build-up immediately",
    "Defensive structure compromised",
    "Increase defensive compactness",
    "Lower press intensity",
    "Monitor defensive shape",
    "Reinforce defensive width",
]
RATIONALE_ITEMS = [
    "Shift full-back to inverted role",
    "Increase press intensity in zone 14",
    "Slow build-up tempo",
    "Increase defensive compactness",
    "Lower press intensity",
    "Reduce central build-up",
]
DRIVERS = [
    "territory_tilt",
    "turnover_burstiness",
    "defensive_actions_per_min",
    "pass_accuracy_slope",
    "shots_conceded_per_min",
    "final_third_entries_per_min",
    "tempo_variance",
    "env_stress_multiplier",
]
DEFAULT_PLAYERS = [
    "Busquets", "Rodri", "Pedri", "Gavi", "Olmo",
    "Alba", "Laporte", "Torres", "Morata", "Williams",
]


def _seed(match_id: int, team: str = ""):
    """Deterministic seed from match_id and team (stable across process runs)."""
    # Use only match_id and sum(ord) for team so output is stable and varies per match/team
    team_part = sum(ord(c) for c in (team or "")) % (2**20)
    h = (match_id * 131 + team_part) % (2**31)
    return abs(h) if h else 1


def synthetic_timeline(match_id: int, team: str, num_minutes: int = 96):
    """Generate timeline points so each match has a clearly different curve.

    Parameters are tuned so avg_risk spans ~0.20–0.72, giving a realistic
    mix of LOW / MED / HIGH teams across the tournament.
    """
    s = _seed(match_id, team)
    out = []
    # Use different bit-slices of the seed for each param so they vary independently
    # (WC match_ids are close together; simple mod produces correlated values)
    peak_minute = 30 + (s >> 3) % 50       # 30–80
    slope       = 0.0003 + (s >> 9)  % 9  / 8000   # 0.0003–0.0014
    base_level  = 0.14  + (s >> 5)  % 55  / 100    # 0.14–0.68  → LOW to HIGH
    hump_size   = 0.08  + (s >> 14) % 38  / 100    # 0.08–0.45
    for i in range(num_minutes):
        base = base_level + i * slope
        dist = abs(i - peak_minute)
        hump = hump_size * max(0, 1 - dist / 22)
        prob = base + hump
        noise = ((s + i * 17) % 11 - 5) / 400
        prob = min(0.90, max(0.06, prob + noise))
        cusum = (i in (25, 50, 75)) or (i == peak_minute and (s % 2 == 0))
        out.append({"minute": i, "probability": round(prob, 4), "cusum_flag": cusum})
    return out


GOAL_TYPES = ["open_play", "penalty", "direct_free_kick", "open_play", "open_play", "header"]


def synthetic_goals(match_id: int, home_team: str = "Home", away_team: str = "Away",
                    home_score: int = 1, away_score: int = 1):
    """Generate exactly home_score + away_score goals with deterministic minutes and types.
    Scorer names are intentionally omitted for synthetic data — only real data carries them."""
    s = _seed(match_id, "goals")
    minute_pool = [
        10 + s % 8, 22 + s % 10, 34 + s % 7, 44 + (s // 3) % 8,
        54 + s % 9, 63 + (s // 5) % 10, 73 + s % 8, 83 + (s // 7) % 7,
    ]
    home_goals, away_goals = [], []
    home_left, away_left = home_score, away_score
    for i, minute in enumerate(minute_pool):
        goal_type = GOAL_TYPES[(s + i * 13) % len(GOAL_TYPES)]
        if home_left > 0 and (i % 2 == 0 or away_left == 0):
            home_goals.append({"minute": minute, "scoring_team": home_team,
                                "conceding_team": away_team, "goal_type": goal_type, "scorer": ""})
            home_left -= 1
        elif away_left > 0:
            away_goals.append({"minute": minute, "scoring_team": away_team,
                                "conceding_team": home_team, "goal_type": goal_type, "scorer": ""})
            away_left -= 1
        if home_left == 0 and away_left == 0:
            break
    return sorted(home_goals + away_goals, key=lambda g: g["minute"])


FEATURE_KEYS = [
    "pass_accuracy_slope", "turnover_per_min", "turnover_burstiness",
    "defensive_actions_per_min", "final_third_entries_per_min", "shots_conceded_per_min",
    "tempo_variance", "territory_tilt", "env_stress_multiplier",
]


def synthetic_window(match_id: int, minute: int, team: str):
    """Single window with headline, rationale, drivers (distinct per match/minute/team)."""
    s = _seed(match_id, f"{team}_{minute}")
    prob = 0.15 + (minute / 95) * 0.5 + (s % 40) / 100
    prob = min(0.92, max(0.1, prob))
    idx = (match_id + minute + s % 10) % len(HEADLINES)
    headline = HEADLINES[idx]
    rationale = [RATIONALE_ITEMS[(idx + i) % len(RATIONALE_ITEMS)] for i in range(3)]
    d1, d2, d3 = DRIVERS[(s % 8)], DRIVERS[(s // 8) % 8], DRIVERS[(s // 64) % 8]
    if d2 == d1:
        d2 = DRIVERS[(s % 7)]
    if d3 == d1 or d3 == d2:
        d3 = DRIVERS[(s % 6 + 2) % 8]
    features = {k: round(0.1 + ((s + sum(ord(c) for c in k)) % 100) / 200, 4) for k in FEATURE_KEYS}
    # territory_tilt should vary between -1 and 1 per minute (negative = pressing high, positive = under pressure)
    features["territory_tilt"] = round(((s * 3 + minute * 17) % 200 - 100) / 110, 4)
    return {
        "minute": minute,
        "probability": round(prob, 4),
        "features": features,
        "headline": headline,
        "rationale": rationale,
        "risk_delta": round(-0.15 - (s % 20) / 100, 4),
        "driver_1": d1,
        "driver_2": d2,
        "driver_3": d3,
        "top_3_drivers": [d1, d2, d3],
    }


def synthetic_counterfactual(match_id: int, minute: int, team: str, num_minutes: int = 96):
    """Projected risk path after intervention (distinct per match/minute/team)."""
    s = _seed(match_id, f"cf_{team}_{minute}")
    out = []
    base_start = 0.35 + (s % 25) / 100
    decay_rate = 0.3 + (s % 20) / 100
    for i in range(minute, num_minutes):
        decay = 1 - decay_rate * (i - minute) / 25
        decay = max(0.25, min(1.0, decay))
        proj = max(0.05, min(0.88, base_start - 0.35 * decay + ((s + i) % 7) / 200))
        out.append({"projected_minute": i, "projected_prob": round(proj, 4)})
    return out


def synthetic_network(match_id: int, minute: int, team: str):
    """Synthetic pass network nodes and edges."""
    s = _seed(match_id, f"net_{team}_{minute}")
    names = DEFAULT_PLAYERS[:] if (s % 2 == 0) else [
        "Griezmann", "Mbappé", "Rabiot", "Tchouaméni", "Dembélé",
        "Hernández", "Varane", "Koundé", "Giroud", "Coman",
    ]
    nodes = []
    for i, name in enumerate(names):
        nodes.append({
            "player": name,
            "centrality": round(0.1 + (s + i) % 40 / 100, 4),
            "influence_score": round(0.4 + (s + i * 7) % 55 / 100, 4),
            "fatigue_score": round(0.6 + (s + i * 3) % 35 / 100, 4),
            "minutes_played": minute,
        })
    edges = []
    for i in range(len(names)):
        for j in range(len(names)):
            if i != j and (s + i * 11 + j * 7) % 3 == 0:
                edges.append({
                    "from_player": names[i],
                    "to_player": names[j],
                    "pass_count": 3 + (s + i + j) % 12,
                })
    if not edges:
        edges = [
            {"from_player": names[0], "to_player": names[1], "pass_count": 10},
            {"from_player": names[1], "to_player": names[2], "pass_count": 8},
        ]
    return {"nodes": nodes, "edges": edges}
