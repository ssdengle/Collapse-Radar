"""Logistic regression collapse-risk model and validation metrics."""
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score


def fit_predict(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: list[str] | None = None,
) -> tuple[LogisticRegression, np.ndarray, dict]:
    """
    Fit logistic regression and return (model, proba_predictions, metrics_dict).
    y is binary: 1 = collapse (goal conceded in next 10 min), 0 = no collapse.
    """
    model = LogisticRegression(max_iter=500, random_state=42)
    model.fit(X, y)
    proba = model.predict_proba(X)[:, 1]
    auc = roc_auc_score(y, proba) if len(np.unique(y)) > 1 else 0.0
    return model, proba, {"auc": auc}


def compute_lead_time_minutes(
    proba: np.ndarray,
    minutes: np.ndarray,
    threshold: float = 0.65,
) -> float:
    """Average minutes between first crossing threshold and next goal (or end)."""
    above = np.where(proba >= threshold)[0]
    if len(above) == 0:
        return 0.0
    # Simplified: average "run length" of consecutive above-threshold minutes
    runs = []
    start = above[0]
    for i in range(1, len(above)):
        if above[i] - above[i - 1] > 1:
            runs.append(above[i - 1] - start + 1)
            start = above[i]
    runs.append(above[-1] - start + 1)
    return float(np.mean(runs)) if runs else 0.0


def predict_proba_for_minute(
    model: LogisticRegression,
    features_row: np.ndarray,
    env_stress: float = 1.0,
) -> float:
    """Predict collapse probability for one minute; env_stress scales the logit."""
    p = model.predict_proba(features_row.reshape(1, -1))[0, 1]
    # Simple scaling: higher env_stress -> higher risk
    scaled = min(0.99, p * env_stress)
    return float(scaled)
