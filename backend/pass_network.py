"""Pass network: nodes (players with centrality, influence, fatigue) and edges (pass counts)."""
import numpy as np
import networkx as nx


def build_network_from_events(
    events_df,
    team: str,
    up_to_minute: int = 90,
) -> tuple[list[dict], list[dict]]:
    """
    Build pass network for team from events. Returns (nodes, edges).
    nodes: list of {player, centrality, influence_score, fatigue_score, minutes_played}
    edges: list of {from_player, to_player, pass_count}
    """
    if events_df is None or events_df.empty:
        return _synthetic_network(team, up_to_minute)

    # If events have player names use them; else synthetic
    if "player" not in events_df.columns and "player_name" not in events_df.columns:
        return _synthetic_network(team, up_to_minute)

    player_col = "player_name" if "player_name" in events_df.columns else "player"
    ev = events_df[
        (events_df["minute"] <= up_to_minute)
        & (events_df["type"].str.lower().eq("pass"))
    ].copy()
    if ev.empty:
        return _synthetic_network(team, up_to_minute)

    ev = ev[ev[player_col].notna()]
    if ev.empty:
        return _synthetic_network(team, up_to_minute)

    # Build directed graph: passer -> receiver (simplified: use same player col for both if no receiver)
    if "pass_recipient" in ev.columns:
        ev["from_player"] = ev[player_col].astype(str)
        ev["to_player"] = ev["pass_recipient"].astype(str)
    else:
        ev["from_player"] = ev[player_col].astype(str)
        ev["to_player"] = ev[player_col].astype(str)  # self-pass placeholder
    ev = ev[ev["from_player"] != ev["to_player"]]
    if ev.empty:
        return _synthetic_network(team, up_to_minute)

    agg = ev.groupby(["from_player", "to_player"]).size().reset_index(name="pass_count")
    G = nx.from_pandas_edgelist(agg, "from_player", "to_player", edge_attr="pass_count", create_using=nx.DiGraph)
    # Add isolated nodes so all players appear
    for p in ev["from_player"].unique():
        if p not in G:
            G.add_node(p)
    for p in ev["to_player"].unique():
        if p not in G:
            G.add_node(p)

    try:
        centrality = nx.betweenness_centrality(G, weight="pass_count")
    except Exception:
        centrality = {n: 0.1 for n in G.nodes()}
    degree = dict(G.degree(weight="pass_count"))
    influence = {n: min(1.0, (degree.get(n, 0) / 50) * 0.5 + centrality.get(n, 0) * 0.5) for n in G.nodes()}
    fatigue = {n: 0.7 + np.random.uniform(0, 0.25) for n in G.nodes()}
    minutes_played = {n: up_to_minute for n in G.nodes()}

    nodes = [
        {
            "player": n,
            "centrality": round(centrality.get(n, 0), 4),
            "influence_score": round(influence.get(n, 0.5), 4),
            "fatigue_score": round(fatigue.get(n, 0.8), 4),
            "minutes_played": minutes_played.get(n, up_to_minute),
        }
        for n in G.nodes()
    ]
    edges = [
        {"from_player": u, "to_player": v, "pass_count": int(d["pass_count"])}
        for u, v, d in G.edges(data=True)
    ]
    return nodes, edges


def _synthetic_network(team: str, up_to_minute: int) -> tuple[list[dict], list[dict]]:
    """Synthetic pass network for demo (e.g. Spain/France squad names)."""
    names = [
        "Busquets", "Rodri", "Pedri", "Gavi", "Olmo",
        "Alba", "Laporte", "Torres", "Morata", "Williams",
    ] if team == "Spain" else [
        "Griezmann", "Mbappé", "Rabiot", "Tchouaméni", "Dembélé",
        "Hernández", "Varane", "Koundé", "Giroud", "Coman",
    ]
    np.random.seed(hash(team) % 2**32)
    n = len(names)
    centrality = np.random.uniform(0.1, 0.5, n)
    influence = np.random.uniform(0.4, 0.95, n)
    fatigue = 0.6 + np.random.uniform(0, 0.35, n)
    nodes = [
        {
            "player": names[i],
            "centrality": round(centrality[i], 4),
            "influence_score": round(influence[i], 4),
            "fatigue_score": round(fatigue[i], 4),
            "minutes_played": up_to_minute,
        }
        for i in range(n)
    ]
    edges = []
    for i in range(n):
        for j in range(n):
            if i != j and np.random.rand() < 0.35:
                edges.append({
                    "from_player": names[i],
                    "to_player": names[j],
                    "pass_count": int(np.random.randint(2, 18)),
                })
    return nodes, edges
