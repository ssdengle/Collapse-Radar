"""
Intervention lookup: headline, rationale bullets, risk_delta, top drivers from features.
"""
HEADLINES = [
    "Reduce central build-up immediately",
    "Defensive structure compromised",
    "Increase defensive compactness",
    "Monitor defensive shape",
    "Press intensity dropping",
]
RATIONALE_TEMPLATES = [
    "Increase defensive compactness in midfield",
    "Lower press intensity to preserve energy",
    "Reduce central build-up and protect flanks",
]


def get_recommendation(features: dict, probability: float) -> dict:
    """
    features: dict with FEATURE_KEYS. Returns headline, rationale (3 bullets), risk_delta, driver_1/2/3.
    """
    from feature_engine import FEATURE_KEYS
    sorted_drivers = sorted(
        [(k, abs(features.get(k, 0))) for k in FEATURE_KEYS],
        key=lambda x: -x[1],
    )
    top3 = [sorted_drivers[i][0] for i in range(min(3, len(sorted_drivers)))]
    idx = min(int(probability * 10) % len(HEADLINES), len(HEADLINES) - 1)
    risk_delta = -0.15 - (probability * 0.1)
    return {
        "headline": HEADLINES[idx],
        "rationale": RATIONALE_TEMPLATES,
        "risk_delta": round(risk_delta, 3),
        "driver_1": top3[0] if len(top3) > 0 else "territory_tilt",
        "driver_2": top3[1] if len(top3) > 1 else "turnover_burstiness",
        "driver_3": top3[2] if len(top3) > 2 else "defensive_actions_per_min",
    }
