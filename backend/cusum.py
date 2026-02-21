"""
CUSUM / change-point detection to flag minutes where collapse risk trend shifts.
"""
import numpy as np

try:
    import ruptures
    HAS_RUPTURES = True
except ImportError:
    HAS_RUPTURES = False


def cusum_flags(probabilities: list, threshold: float = 0.3) -> list:
    """
    probabilities: list of float per minute.
    Returns list of bool same length: True where CUSUM change point or local spike.
    """
    p = np.array(probabilities, dtype=float)
    n = len(p)
    if n == 0:
        return []
    flags = [False] * n
    if HAS_RUPTURES and n >= 20:
        try:
            algo = ruptures.Pelt(model="rbf").fit(p.reshape(-1, 1))
            change_points = algo.predict(pen=0.5)
            for cp in change_points:
                if 0 <= cp < n:
                    flags[cp] = True
        except Exception:
            pass
    for i in range(1, n - 1):
        if p[i] - p[i - 1] > threshold * 0.15:
            flags[i] = True
    return flags
