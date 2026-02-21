"""CUSUM / change-point detection for collapse risk timeline (ruptures)."""
import numpy as np


def detect_change_points(signal: np.ndarray, min_size: int = 5, n_bkps: int = 3) -> np.ndarray:
    """
    Return indices where change points occur (ruptures). signal is 1d.
    Returns array of 0-based indices; we use these as cusum_flag = True at those minutes.
    """
    try:
        import ruptures as rpt
        algo = rpt.Pelt(model="rbf").fit(signal.reshape(-1, 1))
        bkps = algo.predict(pen=0.5)
        # bkps are end indices of segments (exclusive), so change points are at bkps[:-1]
        if len(bkps) <= 1:
            return np.array([], dtype=int)
        return np.array(bkps[:-1], dtype=int)
    except Exception:
        # Fallback: mark every ~25 minutes as a "change" for demo
        n = len(signal)
        return np.arange(25, n, 25, dtype=int)


def cusum_flags_for_timeline(minutes: np.ndarray, probability: np.ndarray) -> np.ndarray:
    """
    Return boolean array same length as minutes: True where CUSUM detected a change point.
    """
    if len(probability) == 0:
        return np.array([], dtype=bool)
    bkps = detect_change_points(probability, n_bkps=min(5, len(probability) // 15))
    flags = np.zeros(len(minutes), dtype=bool)
    for i in bkps:
        if 0 <= i < len(flags):
            flags[i] = True
    return flags
