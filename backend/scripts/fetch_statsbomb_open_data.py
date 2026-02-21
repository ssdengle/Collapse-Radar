"""
Download StatsBomb Open Data from GitHub into data/raw/statsbomb/.

Data source: https://github.com/statsbomb/open-data
Structure: competitions.json, matches/{competition_id}/{season_id}.json, events/{match_id}.json

Usage:
  python scripts/fetch_statsbomb_open_data.py                    # default: competitions + 2 seasons, events for first 10 matches
  python scripts/fetch_statsbomb_open_data.py --events 0        # matches only, no events
  python scripts/fetch_statsbomb_open_data.py --events 50       # events for first 50 matches
"""

import argparse
import json
import os
import urllib.request

BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "..", "..", "data", "raw", "statsbomb")


def fetch(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"User-Agent": "CollapseOS/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    ap = argparse.ArgumentParser(description="Fetch StatsBomb Open Data from GitHub")
    ap.add_argument("--events", type=int, default=10, help="Number of matches to download events for (0 = none)")
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, "matches"), exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, "events"), exist_ok=True)

    # 1. Competitions
    print("Fetching competitions.json ...")
    comps = fetch(f"{BASE_URL}/competitions.json")
    with open(os.path.join(OUT_DIR, "competitions.json"), "w") as f:
        json.dump(comps, f, indent=2)
    print(f"  Saved {len(comps)} competition/season entries.")

    # 2. Matches for selected competition/season (La Liga 2004/05, Premier League 2003/04, World Cup 2022)
    # Competition/season IDs from competitions.json: 11/37 La Liga 2004/05, 2/44 Premier League 2003/04, 43/106 WC 2022
    to_fetch = [
        (11, 37),   # La Liga 2004/2005
        (2, 44),    # Premier League 2003/2004
        (43, 106),  # FIFA World Cup 2022 (has France vs Argentina etc.)
    ]
    all_matches = []
    for comp_id, season_id in to_fetch:
        path = f"matches/{comp_id}/{season_id}.json"
        url = f"{BASE_URL}/{path}"
        try:
            print(f"Fetching {path} ...")
            matches = fetch(url)
            subdir = os.path.join(OUT_DIR, "matches", str(comp_id))
            os.makedirs(subdir, exist_ok=True)
            out_path = os.path.join(subdir, f"{season_id}.json")
            with open(out_path, "w") as f:
                json.dump(matches, f, indent=2)
            all_matches.extend(matches)
            print(f"  Saved {len(matches)} matches.")
        except Exception as e:
            print(f"  Skip {path}: {e}")

    if not all_matches:
        print("No matches downloaded. Exiting.")
        return

    # 3. Events for first N matches
    n_events = args.events
    if n_events > 0:
        match_ids = [m["match_id"] for m in all_matches[:n_events]]
        for i, match_id in enumerate(match_ids):
            try:
                url = f"{BASE_URL}/events/{match_id}.json"
                print(f"Fetching events/{match_id}.json ({i+1}/{len(match_ids)}) ...")
                events = fetch(url)
                with open(os.path.join(OUT_DIR, "events", f"{match_id}.json"), "w") as f:
                    json.dump(events, f)
            except Exception as e:
                print(f"  Skip events {match_id}: {e}")

    print(f"Done. Data in {OUT_DIR}")


if __name__ == "__main__":
    main()
