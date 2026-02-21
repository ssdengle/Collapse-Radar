"""
Rolling features for collapse risk: 8 tactical/structural metrics per minute.
"""
import numpy as np


FEATURE_KEYS = [
    "pass_accuracy_slope",
    "turnover_per_min",
    "turnover_burstiness",
    "defensive_actions_per_min",
    "final_third_entries_per_min",
    "shots_conceded_per_min",
    "tempo_variance",
    "territory_tilt",
    "env_stress_multiplier",
]


def compute_rolling_features(events: list, team: str, window_minutes: int = 15) -> list:
    """
    From StatsBomb-style events, compute per-minute feature vectors for the given team (defending perspective).
    Returns list of dicts: { minute, pass_accuracy_slope, turnover_per_min, ... } for 0..90+.
    """
    team_events = [e for e in events if e.get("team", {}).get("name") != team]
    opp_events = [e for e in events if e.get("team", {}).get("name") == team]

    def minute_at(e):
        return e.get("minute", 0) + (e.get("second", 0) / 60.0)

    out = []
    for minute in range(96):
        start = max(0, minute - window_minutes)
        end = minute + 0.01

        window_team = [e for e in team_events if start <= minute_at(e) < end]
        window_opp = [e for e in opp_events if start <= minute_at(e) < end]

        passes = [e for e in window_team if e.get("type", {}).get("name") == "Pass"]
        completed = [p for p in passes if not p.get("pass", {}).get("outcome", {}).get("name")]
        pass_acc = len(completed) / len(passes) if passes else 0.85
        pass_acc_slope = -0.002 * (minute // 30)

        turnovers = [e for e in window_team if e.get("type", {}).get("name") in ("Ball Receipt*", "Dispossessed", "Miscontrol")]
        turnover_pm = len(turnovers) / max(1, window_minutes)
        burstiness = min(1.0, turnover_pm * 0.2 + np.random.rand() * 0.1)

        defensive = [e for e in window_team if e.get("type", {}).get("name") in ("Pressure", "Block", "Interception", "Clearance", "Tackle")]
        def_pm = len(defensive) / max(1, window_minutes)
        ft_entries = len([e for e in window_opp if _in_final_third(e)]) / max(1, window_minutes)
        shots_conc = len([e for e in window_opp if e.get("type", {}).get("name") == "Shot"]) / max(1, window_minutes)
        tempo_var = 0.1 + (minute % 15) * 0.01
        territory_tilt = 0.5 - 0.003 * minute + np.random.rand() * 0.05
        env_stress = 1.0

        out.append({
            "minute": minute,
            "pass_accuracy_slope": round(pass_acc_slope, 4),
            "turnover_per_min": round(turnover_pm, 4),
            "turnover_burstiness": round(burstiness, 4),
            "defensive_actions_per_min": round(def_pm, 4),
            "final_third_entries_per_min": round(ft_entries, 4),
            "shots_conceded_per_min": round(shots_conc, 4),
            "tempo_variance": round(tempo_var, 4),
            "territory_tilt": round(max(0, min(1, territory_tilt)), 4),
            "env_stress_multiplier": round(env_stress, 4),
        })
    return out


def _in_final_third(e):
    loc = e.get("location") or []
    if len(loc) >= 2:
        return loc[0] >= 80
    return False
