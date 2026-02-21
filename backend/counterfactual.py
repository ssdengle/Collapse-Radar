"""Counterfactual (what-if) projection: projected risk path after intervention at a minute."""
import numpy as np


def compute_counterfactual(
    minutes: np.ndarray,
    actual_proba: np.ndarray,
    intervention_minute: int,
    risk_reduction: float = 0.4,
) -> list[tuple[int, float]]:
    """
    Return list of (projected_minute, projected_prob) for minutes >= intervention_minute.
    After intervention, projected prob decays from actual toward (actual - risk_reduction).
    """
    out = []
    for i, m in enumerate(minutes):
        if m < intervention_minute:
            continue
        actual = actual_proba[i] if i < len(actual_proba) else 0.5
        # Decay toward lower risk as we move further from intervention
        decay = 1 - 0.5 * (m - intervention_minute) / 30
        decay = max(0.3, min(1.0, decay))
        projected = actual - risk_reduction * decay
        projected = max(0.05, min(0.95, projected))
        out.append((int(m), float(projected)))
    return out
