import type {
  Match,
  DashboardStats,
  TimelinePoint,
  GoalMarker,
  MatchWindow,
  CounterfactualPoint,
  PassNetwork,
  PlayerRemovalResult,
  WC2026Venue,
  FixtureComparison,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

// Matches
export async function fetchMatches(): Promise<Match[]> {
  return get<Match[]>('/api/matches')
}

export async function fetchMatch(matchId: string): Promise<Match> {
  return get<Match>(`/api/matches/${matchId}`)
}

// Dashboard
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return get<DashboardStats>('/api/dashboard/stats')
}

// Timeline & goals (for War Room)
export async function fetchTimeline(matchId: string): Promise<TimelinePoint[]> {
  return get<TimelinePoint[]>(`/api/matches/${matchId}/timeline`)
}

export async function fetchGoals(matchId: string): Promise<GoalMarker[]> {
  return get<GoalMarker[]>(`/api/matches/${matchId}/goals`)
}

// Match window (timeline + goals for a range)
export async function fetchMatchWindow(
  matchId: string,
  minuteFrom: number,
  minuteTo: number
): Promise<MatchWindow> {
  return get<MatchWindow>(
    `/api/matches/${matchId}/window?minute_from=${minuteFrom}&minute_to=${minuteTo}`
  )
}

// Counterfactual (Coach Mode)
export async function fetchCounterfactual(
  matchId: string,
  interventionMinute: number
): Promise<CounterfactualPoint[]> {
  return get<CounterfactualPoint[]>(
    `/api/matches/${matchId}/counterfactual?intervention_minute=${interventionMinute}`
  )
}

// Pass network (Injury Sim / graph)
export async function fetchPassNetwork(
  matchId: string,
  upToMinute?: number
): Promise<PassNetwork> {
  const q = upToMinute != null ? `?up_to_minute=${upToMinute}` : ''
  return get<PassNetwork>(`/api/matches/${matchId}/pass-network${q}`)
}

// Player removal simulation
export async function simulatePlayerRemoval(
  matchId: string,
  playerId: string
): Promise<PlayerRemovalResult> {
  return post<PlayerRemovalResult>(`/api/matches/${matchId}/simulate-removal`, {
    player_id: playerId,
  })
}

// WC 2026 venues
export async function fetchWC2026Venues(): Promise<WC2026Venue[]> {
  return get<WC2026Venue[]>('/api/wc2026/venues')
}

// Fixture comparison
export async function fetchFixtureComparisons(): Promise<FixtureComparison[]> {
  return get<FixtureComparison[]>('/api/wc2026/fixture-comparisons')
}

export async function fetchFixtureComparison(
  fixtureId: number
): Promise<FixtureComparison> {
  return get<FixtureComparison>(`/api/wc2026/fixture-comparisons/${fixtureId}`)
}
