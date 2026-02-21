// Match & fixtures
export interface Match {
  id: string
  home_team: string
  away_team: string
  competition: string
  date: string
  venue_id?: string
  status?: string
}

// Dashboard overview stats
export interface DashboardStats {
  total_matches: number
  avg_collapse_risk: number
  active_alerts: number
  high_risk_moments: number
}

// Timeline (collapse risk per minute)
export interface TimelinePoint {
  minute: number
  probability: number
}

// Goal event
export interface GoalMarker {
  minute: number
  team: 'home' | 'away'
  scorer?: string
}

// Match time window (e.g. for slider/range queries)
export interface MatchWindow {
  match_id: string
  minute_from: number
  minute_to: number
  timeline: TimelinePoint[]
  goals: GoalMarker[]
}

// Counterfactual / what-if point (actual vs projected risk)
export interface CounterfactualPoint {
  minute: number
  actual: number
  projected: number
}

// Pass network (nodes = players, links = passes)
export interface PassNetworkNode {
  id: string
  name: string
  position: string
  x?: number
  y?: number
}

export interface PassNetworkLink {
  source: string
  target: string
  value: number
}

export interface PassNetwork {
  nodes: PassNetworkNode[]
  links: PassNetworkLink[]
}

// Result of simulating removal of a player
export interface PlayerRemovalResult {
  player_id: string
  player_name: string
  delta_risk: number
  new_risk: number
  recommendation?: string
}

// WC 2026 venue (city, conditions)
export interface WC2026Venue {
  id: number
  city: string
  country: string
  lat: number
  lng: number
  elevation: string
  temp: string
  humidity: string
  stress: string
  color?: string
}

// Fixture + comparison (teams, date, venue comparison)
export interface FixtureComparison {
  id: number
  team_a: string
  team_b: string
  date: string
  venue_a: WC2026Venue
  venue_b: WC2026Venue
  risk_delta?: number
}
