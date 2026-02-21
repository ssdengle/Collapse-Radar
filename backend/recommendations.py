"""Intervention recommendations per minute: headline, rationale, risk_delta, top drivers."""
import numpy as np

HEADLINES = [
    "Reduce central build-up immediately",
    "Defensive Structure Compromised",
    "Increase defensive compactness",
    "Lower press intensity",
    "Monitor defensive shape",
    "Reinforce defensive width",
    "Slow build-up tempo",
]

RATIONALE_TEMPLATES = [
    "Shift left-back to inverted role",
    "Increase press intensity zone 14",
    "Slow build-up tempo",
    "Increase defensive compactness",
    "Lower press intensity",
    "Reduce central build-up",
]

DRIVER_KEYS = [
    "territory_tilt",
    "turnover_burstiness",
    "defensive_actions_per_min",
    "pass_accuracy_slope",
    "shots_conceded_per_min",
    "final_third_entries_per_min",
    "tempo_variance",
    "env_stress_multiplier",
]


def get_recommendation_for_minute(
    minute: int,
    probability: float,
    features: dict,
) -> dict:
    """
    Return dict: headline, rationale (list of 3 strings), risk_delta (float), driver_1, driver_2, driver_3.
    """
    idx = minute % len(HEADLINES)
    headline = HEADLINES[idx]
    rationale = [
        RATIONALE_TEMPLATES[idx % len(RATIONALE_TEMPLATES)],
        RATIONALE_TEMPLATES[(idx + 1) % len(RATIONALE_TEMPLATES)],
        RATIONALE_TEMPLATES[(idx + 2) % len(RATIONALE_TEMPLATES)],
    ]
    # risk_delta: negative = intervention reduces risk
    risk_delta = -0.15 - (probability * 0.3) + np.random.uniform(-0.05, 0.05)
    risk_delta = np.clip(risk_delta, -0.5, 0.1)

    # Top 3 drivers by feature magnitude (use keys that match API)
    f = features
    keys_ordered = [
        "territory_tilt",
        "turnover_burstiness",
        "defensive_actions_per_min",
        "pass_accuracy_slope",
        "shots_conceded_per_min",
        "final_third_entries_per_min",
        "tempo_variance",
        "env_stress_multiplier",
    ]
    vals = [abs(f.get(k, 0)) for k in keys_ordered]
    order = np.argsort(vals)[::-1][:3]
    drivers = [keys_ordered[i] for i in order]
    return {
        "headline": headline,
        "rationale_1": rationale[0],
        "rationale_2": rationale[1],
        "rationale_3": rationale[2],
        "risk_delta": float(risk_delta),
        "driver_1": drivers[0] if len(drivers) > 0 else "territory_tilt",
        "driver_2": drivers[1] if len(drivers) > 1 else "turnover_burstiness",
        "driver_3": drivers[2] if len(drivers) > 2 else "defensive_actions_per_min",
    }
