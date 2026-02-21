"""
Logistic regression model for collapse probability. Trained on rolling features.
"""
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score


def train_model(feature_matrix: np.ndarray, labels: np.ndarray):
    """
    feature_matrix: (n_samples, n_features), labels: (n_samples,) binary.
    Returns fitted LogisticRegression and AUC.
    """
    clf = LogisticRegression(max_iter=500, random_state=42)
    scores = cross_val_score(clf, feature_matrix, labels, cv=3, scoring="roc_auc")
    clf.fit(feature_matrix, labels)
    return clf, float(np.mean(scores))


def predict_proba(clf, features: dict) -> float:
    """Single minute feature dict -> probability."""
    from feature_engine import FEATURE_KEYS
    x = np.array([[features.get(k, 0) for k in FEATURE_KEYS]])
    return float(clf.predict_proba(x)[0, 1])
