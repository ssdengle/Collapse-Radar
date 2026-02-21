"""
Pass network: NetworkX centrality, influence and fatigue proxies, edges = pass counts.
"""
import networkx as nx


def build_pass_network(events: list, team: str, minute_from: int = 0, minute_to: int = 96) -> tuple:
    """
    From StatsBomb events, build pass network for team in [minute_from, minute_to).
    Returns (nodes, edges): nodes = [ { player, centrality, influence_score, fatigue_score, minutes_played } ], edges = [ { from_player, to_player, pass_count } ].
    """
    G = nx.DiGraph()
    player_minutes = {}

    for e in events:
        if e.get("team", {}).get("name") != team:
            continue
        m = e.get("minute", 0) + (e.get("second", 0) / 60.0)
        if not (minute_from <= m < minute_to):
            continue
        pname = e.get("player", {}).get("name") or "Unknown"
        player_minutes[pname] = player_minutes.get(pname, 0) + (1 / 60.0)

        if e.get("type", {}).get("name") == "Pass":
            receiver = (e.get("pass", {}).get("recipient", {}).get("name") or
                       (e.get("pass", {}).get("end_location") and "Unknown") or "Unknown")
            if receiver and receiver != pname:
                if G.has_edge(pname, receiver):
                    G[pname][receiver]["weight"] += 1
                else:
                    G.add_edge(pname, receiver, weight=1)

    if not G:
        return [], []

    try:
        centrality = nx.eigenvector_centrality_numpy(G, weight="weight")
    except Exception:
        centrality = {n: 1.0 / max(len(G), 1) for n in G}

    nodes = []
    for n in G:
        c = centrality.get(n, 0)
        mins = player_minutes.get(n, 0) * (minute_to - minute_from) / 60.0
        influence = min(100, 20 + c * 80)
        fatigue = min(100, 30 + (mins / 90.0) * 60)
        nodes.append({
            "player": n,
            "centrality": round(c, 4),
            "influence_score": round(influence, 2),
            "fatigue_score": round(fatigue, 2),
            "minutes_played": int(mins),
        })

    edges = []
    for u, v, d in G.edges(data=True):
        edges.append({
            "from_player": u,
            "to_player": v,
            "pass_count": d.get("weight", 1),
        })

    return nodes, edges
