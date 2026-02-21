import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Match } from '../../lib/types';
import { DEMO_MATCH_ID } from '../../lib/api';

interface MatchContextValue {
  matchId: number;
  team: string;
  match: Match | null;
  setMatch: (match: Match | null, team: string) => void;
}

const MatchContext = createContext<MatchContextValue | null>(null);

const DEFAULT_TEAM = 'Spain';

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const [matchId, setMatchId] = useState(DEMO_MATCH_ID);
  const [team, setTeam] = useState(DEFAULT_TEAM);
  const [match, setMatchState] = useState<Match | null>(null);

  const setMatch = useCallback((m: Match | null, t: string) => {
    if (m) {
      setMatchId(m.match_id);
      setTeam(t || DEFAULT_TEAM);
      setMatchState(m);
    } else {
      setMatchId(DEMO_MATCH_ID);
      setTeam(DEFAULT_TEAM);
      setMatchState(null);
    }
  }, []);

  const value = useMemo(
    () => ({ matchId, team, match, setMatch }),
    [matchId, team, match, setMatch]
  );

  return (
    <MatchContext.Provider value={value}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) {
    return {
      matchId: DEMO_MATCH_ID,
      team: DEFAULT_TEAM,
      match: null,
      setMatch: () => {},
    };
  }
  return ctx;
}
