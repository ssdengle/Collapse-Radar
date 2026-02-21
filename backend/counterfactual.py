"""
Counterfactual projection: if intervention at minute M, projected risk curve after M.
Uses nearest-neighbor or simple decay model.
"""
import copy


def project_counterfactual(
    timeline_probabilities: list,
    intervention_minute: int,
    risk_delta: float,
) -> list:
    """
    timeline_probabilities: list of (minute, prob).
    From intervention_minute onward, project prob - abs(risk_delta) decay.
    Returns list of { projected_minute, projected_prob }.
    """
    out = []
    for i, (minute, prob) in enumerate(timeline_probabilities):
        if minute < intervention_minute:
            continue
        decay = (minute - intervention_minute) * 0.008
        new_prob = max(0.05, prob + risk_delta + decay)
        out.append({"projected_minute": minute, "projected_prob": round(new_prob, 4)})
    return out
