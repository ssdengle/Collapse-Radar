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

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const [matchId, setMatchId] = useState(0);
  const [team, setTeam] = useState('');
  const [match, setMatchState] = useState<Match | null>(null);

  const setMatch = useCallback((m: Match | null, t: string) => {
    if (m) {
      setMatchId(m.match_id);
      setTeam(t);
      setMatchState(m);
    } else {
      setMatchId(0);
      setTeam('');
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
      matchId: 0,
      team: '',
      match: null,
      setMatch: () => {},
    };
  }
  return ctx;
}
