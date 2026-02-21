// CollapseOS API types (aligned with FastAPI backend)

export interface TimelinePoint {
  minute: number
  probability: number
  cusum_flag: boolean
}

export interface MatchWindow {
  minute: number
  probability: number
  features: {
    pass_accuracy_slope: number
    turnover_per_min: number
    turnover_burstiness: number
    defensive_actions_per_min: number
    final_third_entries_per_min: number
    shots_conceded_per_min: number
    tempo_variance: number
    territory_tilt: number
    env_stress_multiplier: number
  }
  top_3_drivers: string[]
  headline: string
  rationale: string[]
  risk_delta: number
  driver_1: string
  driver_2: string
  driver_3: string
}

export interface GoalMarker {
  minute: number
  scoring_team: string
  conceding_team: string
}

export interface CounterfactualPoint {
  projected_minute: number
  projected_prob: number
}

export interface PassNode {
  player: string
  centrality: number
  influence_score: number
  fatigue_score: number
  minutes_played: number
}

export interface PassEdge {
  from_player: string
  to_player: string
  pass_count: number
}

export interface PassNetwork {
  nodes: PassNode[]
  edges: PassEdge[]
}

export interface PlayerRemovalResult {
  removed_player: string
  original_probability: number
  new_probability: number
  delta: number
}

export interface Match {
  match_id: number
  competition: string
  season: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  match_date: string
  is_demo_match: boolean
}

export interface WC2026Venue {
  venue_id: number
  city: string
  country: string
  lat: number
  lon: number
  elevation_ft: number
  june_temp_f: number
  humidity_pct: number
  stress_factor: number
}

export interface FixtureComparison {
  team_a: string
  team_b: string
  venue: WC2026Venue
  env_stress: number
  base_probability: number
  adjusted_probability: number
}

export interface DashboardStats {
  total_matches_analyzed: number
  model_auc: number
  avg_lead_time_minutes: number
  total_warnings_fired: number
  demo_match: Match | null
  last_updated: string
}
