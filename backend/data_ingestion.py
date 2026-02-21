"""
Load match and event data. Supports StatsBomb open-data format.
Dataset: https://github.com/statsbomb/open-data (e.g. commit 3bfbffe)
"""
import os
import json
import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
STATSBOMB_BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"

DEMO_MATCH_ID = 3943043


def _load_json_local(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_json_url(url: str):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json()


def get_competitions():
    local = os.path.join(RAW_DIR, "competitions.json")
    if os.path.exists(local):
        return _load_json_local(local)
    return _load_json_url(f"{STATSBOMB_BASE}/competitions.json")


def get_matches(competition_id: int, season_id: int):
    local = os.path.join(RAW_DIR, "matches", str(competition_id), f"{season_id}.json")
    if os.path.exists(local):
        return _load_json_local(local)
    return _load_json_url(f"{STATSBOMB_BASE}/matches/{competition_id}/{season_id}.json")


def get_events(match_id: int):
    local = os.path.join(RAW_DIR, "events", f"{match_id}.json")
    if os.path.exists(local):
        return _load_json_local(local)
    return _load_json_url(f"{STATSBOMB_BASE}/events/{match_id}.json")


def get_lineups(match_id: int):
    local = os.path.join(RAW_DIR, "lineups", f"{match_id}.json")
    if os.path.exists(local):
        return _load_json_local(local)
    return _load_json_url(f"{STATSBOMB_BASE}/lineups/{match_id}.json")


def find_demo_match():
    """Find match 3943043 in competitions or return None."""
    comps = get_competitions()
    for c in comps:
        cid = c["competition_id"]
        sid = c["season_id"]
        try:
            matches = get_matches(cid, sid)
            for m in matches:
                if m.get("match_id") == DEMO_MATCH_ID:
                    return m
        except Exception:
            continue
    return None


def get_demo_events_and_lineups():
    """Load events and lineups for demo match. Returns (events, lineups) or (None, None)."""
    try:
        events = get_events(DEMO_MATCH_ID)
        lineups = get_lineups(DEMO_MATCH_ID)
        return events, lineups
    except Exception:
        return None, None
