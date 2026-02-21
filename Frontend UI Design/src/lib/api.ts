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

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const DEMO_MATCH_ID = 3943043

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

export function getMatches(): Promise<Match[]> {
  return fetchJSON<Match[]>('/api/matches')
}

export function getDashboardStats(): Promise<DashboardStats> {
  return fetchJSON<DashboardStats>('/api/dashboard/stats')
}

export function getTimeline(matchId: number, team: string): Promise<TimelinePoint[]> {
  return fetchJSON<TimelinePoint[]>(`/api/match/${matchId}/timeline?team=${encodeURIComponent(team)}`)
}

export function getGoals(matchId: number): Promise<GoalMarker[]> {
  return fetchJSON<GoalMarker[]>(`/api/match/${matchId}/goals`)
}

export function getWindow(matchId: number, minute: number, team: string): Promise<MatchWindow> {
  return fetchJSON<MatchWindow>(`/api/match/${matchId}/window/${minute}?team=${encodeURIComponent(team)}`)
}

export function getCounterfactual(
  matchId: number,
  minute: number,
  team: string
): Promise<CounterfactualPoint[]> {
  return fetchJSON<CounterfactualPoint[]>(
    `/api/match/${matchId}/counterfactual/${minute}?team=${encodeURIComponent(team)}`
  )
}

export function getPassNetwork(
  matchId: number,
  minute: number,
  team: string
): Promise<PassNetwork> {
  return fetchJSON<PassNetwork>(
    `/api/match/${matchId}/network/${minute}?team=${encodeURIComponent(team)}`
  )
}

export function simulatePlayerRemoval(
  matchId: number,
  team: string,
  player: string,
  minute: number
): Promise<PlayerRemovalResult> {
  return postJSON<PlayerRemovalResult>(`/api/match/${matchId}/simulate_removal`, {
    team,
    player,
    minute,
  })
}

export function getWC2026Venues(): Promise<WC2026Venue[]> {
  return fetchJSON<WC2026Venue[]>('/api/wc2026/venues')
}

export function getFixtureComparison(
  teamA: string,
  teamB: string,
  venueCity: string
): Promise<FixtureComparison> {
  return fetchJSON<FixtureComparison>(
    `/api/wc2026/fixture?team_a=${encodeURIComponent(teamA)}&team_b=${encodeURIComponent(teamB)}&venue_city=${encodeURIComponent(venueCity)}`
  )
}
