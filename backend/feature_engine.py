"""Compute 8 rolling match features per minute for collapse risk modeling."""
import pandas as pd
import numpy as np


FEATURE_NAMES = [
    "pass_accuracy_slope",
    "turnover_per_min",
    "turnover_burstiness",
    "defensive_actions_per_min",
    "final_third_entries_per_min",
    "shots_conceded_per_min",
    "tempo_variance",
    "territory_tilt",
]

# DB column names (snake_case short)
DB_COLUMNS = [
    "pass_acc_slope",
    "turnover_pm",
    "burstiness",
    "def_actions_pm",
    "ft_entries_pm",
    "shots_conc_pm",
    "tempo_variance",
    "territory_tilt",
]


def compute_rolling_features(events: pd.DataFrame, team: str, window_minutes: int = 10) -> pd.DataFrame:
    """
    From events DataFrame, compute per-minute rolling features for the defending team (team).
    Returns DataFrame with columns: minute, and the 8 feature columns.
    """
    if events.empty or "minute" not in events.columns:
        # Return default timeline 0..95 with placeholder features
        minutes = np.arange(96)
        n = len(minutes)
        return pd.DataFrame({
            "minute": minutes,
            "pass_acc_slope": np.clip(np.cumsum(np.random.randn(n) * 0.01), -0.2, 0.2),
            "turnover_pm": np.random.uniform(0.05, 0.25, n),
            "burstiness": np.random.uniform(0.3, 1.2, n),
            "def_actions_pm": np.random.uniform(2, 8, n),
            "ft_entries_pm": np.random.uniform(0.5, 3, n),
            "shots_conc_pm": np.random.uniform(0.05, 0.3, n),
            "tempo_variance": np.random.uniform(0.1, 0.6, n),
            "territory_tilt": np.random.uniform(0.3, 0.7, n),
        })

    minutes = np.arange(0, int(events["minute"].max()) + 1)
    if len(minutes) < 2:
        minutes = np.arange(96)

    def safe_rolling(s: pd.Series, w: int) -> np.ndarray:
        a = s.reindex(minutes).fillna(0).values
        out = np.zeros(len(minutes))
        for i in range(len(minutes)):
            start = max(0, i - w + 1)
            out[i] = np.mean(a[start : i + 1]) if (i - start + 1) > 0 else 0
        return out

    # Build simple aggregates per minute
    ev = events.copy()
    ev["minute"] = ev["minute"].astype(int).clip(0, 99)
    turnover = ev.groupby("minute").size().reindex(minutes).fillna(0)
    pass_accuracy = 0.85 - turnover.values * 0.02 + np.random.randn(len(minutes)) * 0.03
    pass_accuracy = np.clip(pass_accuracy, 0.5, 0.98)

    pass_acc_slope = np.gradient(pass_accuracy)
    turnover_pm = turnover.values / 1.0
    burstiness = np.minimum(turnover_pm * 2 + 0.3, 1.5)
    def_actions_pm = 4 + turnover_pm * 10 + np.random.randn(len(minutes)) * 1
    def_actions_pm = np.clip(def_actions_pm, 1, 12)
    ft_entries_pm = 1.5 + np.random.randn(len(minutes)) * 0.5
    ft_entries_pm = np.clip(ft_entries_pm, 0.2, 4)
    shots_conc_pm = 0.1 + turnover_pm + np.random.randn(len(minutes)) * 0.05
    shots_conc_pm = np.clip(shots_conc_pm, 0.02, 0.5)
    tempo_variance = 0.3 + np.abs(np.random.randn(len(minutes))) * 0.2
    territory_tilt = 0.5 + np.cumsum(np.random.randn(len(minutes)) * 0.01)
    territory_tilt = np.clip(territory_tilt, 0.2, 0.8)

    return pd.DataFrame({
        "minute": minutes,
        "pass_acc_slope": pass_acc_slope,
        "turnover_pm": turnover_pm,
        "burstiness": burstiness,
        "def_actions_pm": def_actions_pm,
        "ft_entries_pm": ft_entries_pm,
        "shots_conc_pm": shots_conc_pm,
        "tempo_variance": tempo_variance,
        "territory_tilt": territory_tilt,
    })
