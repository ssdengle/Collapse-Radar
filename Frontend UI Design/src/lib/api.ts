// src/lib/api.ts — typed API client for CollapseOS backend

import type {
  Match,
  DashboardStats,
  MatchStats,
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

// ── Matches ──────────────────────────────────────────────
export function getMatches() {
  return fetchJSON<Match[]>('/api/matches')
}

export function getMatchTeams(matchId: number) {
  return fetchJSON<string[]>(`/api/match/${matchId}/teams`)
}

export function getDashboardStats() {
  return fetchJSON<DashboardStats>('/api/dashboard/stats')
}

export function getMatchStats(matchId: number) {
  return fetchJSON<MatchStats>(`/api/match/${matchId}/stats`)
}

export function getTeamRisk() {
  return fetchJSON<{ team: string; avg_risk: number; matches: number }[]>('/api/dashboard/team_risk')
}

export function getTopMatches() {
  return fetchJSON<{
    match_id: number
    home_team: string
    away_team: string
    home_score: number
    away_score: number
    match_date: string
    peak_risk: number
    avg_risk: number
  }[]>('/api/dashboard/top_matches')
}

// ── War Room ─────────────────────────────────────────────
export function getTimeline(matchId: number, team: string) {
  return fetchJSON<TimelinePoint[]>(
    `/api/match/${matchId}/timeline?team=${encodeURIComponent(team)}`
  )
}

export function getGoals(matchId: number) {
  return fetchJSON<GoalMarker[]>(`/api/match/${matchId}/goals`)
}

export function getShootout(matchId: number) {
  return fetchJSON<{
    has_shootout: boolean
    penalty_winner?: string
    penalty_score?: string
    kicks?: Record<string, [string, boolean][]>
  }>(`/api/match/${matchId}/shootout`)
}

export function getWindow(matchId: number, minute: number, team: string) {
  return fetchJSON<MatchWindow>(
    `/api/match/${matchId}/window/${minute}?team=${encodeURIComponent(team)}`
  )
}

// ── Coach Mode ───────────────────────────────────────────
export function getCounterfactual(matchId: number, minute: number, team: string) {
  return fetchJSON<CounterfactualPoint[]>(
    `/api/match/${matchId}/counterfactual/${minute}?team=${encodeURIComponent(team)}`
  )
}

// Coach Mode: Gemini AI suggestions
export function getCoachSuggestions(params: {
  team: string
  minute: number
  risk_percent: number
  headline: string
  rationale: string[]
}) {
  return postJSON<{ suggestions: string }>('/api/coach/suggestions', params)
}

// ── Injury Sim ───────────────────────────────────────────
export function getPassNetwork(matchId: number, minute: number, team: string) {
  return fetchJSON<PassNetwork>(
    `/api/match/${matchId}/network/${minute}?team=${encodeURIComponent(team)}`
  )
}

export function simulatePlayerRemoval(
  matchId: number,
  team: string,
  player: string,
  minute: number
) {
  return postJSON<PlayerRemovalResult>(`/api/match/${matchId}/simulate_removal`, {
    team,
    player,
    minute,
  })
}

// ── WC2026 ───────────────────────────────────────────────
export function getWC2026Venues() {
  return fetchJSON<WC2026Venue[]>('/api/wc2026/venues')
}

export function getFixtureComparison(
  teamA: string,
  teamB: string,
  venueCity: string
) {
  return fetchJSON<FixtureComparison>(
    `/api/wc2026/fixture?team_a=${encodeURIComponent(teamA)}&team_b=${encodeURIComponent(teamB)}&venue_city=${encodeURIComponent(venueCity)}`
  )
}
