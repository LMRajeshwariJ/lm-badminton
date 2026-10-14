"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type Dispatch } from "react";
import { createInitialState } from "@/data/initial-state";
import { SCHEMA_VERSION, STORAGE_KEY } from "@/lib/constants";
import { tournamentReducer, type Action } from "@/reducers/tournament-reducer";
import { fetchRemoteConfig, fetchRemoteMatches, hasSupabaseConfig, readAdminSession, readUmpireSession, subscribeToRemoteMatches, writeRemoteAdminState, writeRemoteMatches, type RemoteMatch } from "@/lib/supabase";
import type { AppState, ByeAssignment } from "@/types";

interface TournamentContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  syncConnected: boolean;
  syncReady: boolean;
  syncPending: boolean;
  syncError: string | null;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);
const serverSnapshot = createInitialState();
const listeners = new Set<() => void>();

let clientRaw: string | null | undefined;
let clientSnapshot: AppState = serverSnapshot;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

function isStoredState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as AppState;
  return (
    candidate.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(candidate.matches) &&
    Array.isArray(candidate.teams) &&
    Array.isArray(candidate.players) &&
    Array.isArray(candidate.courts) &&
    Array.isArray(candidate.byes) &&
    (candidate.role === "audience" || candidate.role === "umpire" || candidate.role === "admin")
  );
}

function getServerSnapshot() {
  return serverSnapshot;
}

function getClientSnapshot() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === clientRaw) return clientSnapshot;
  clientRaw = raw;
  if (!raw) {
    clientSnapshot = serverSnapshot;
    return clientSnapshot;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    clientSnapshot = isStoredState(parsed) ? parsed : serverSnapshot;
  } catch {
    clientSnapshot = serverSnapshot;
  }
  return clientSnapshot;
}

function persist(next: AppState) {
  const raw = JSON.stringify(next);
  localStorage.setItem(STORAGE_KEY, raw);
  clientRaw = raw;
  clientSnapshot = next;
  emit();
}

function applyRemoteRows(rows: RemoteMatch[]) {
  const state = getClientSnapshot();
  const matches = rows
    .filter((row) => row.state && row.match_id === row.state.id)
    .map((row) => row.state);
  if (matches.length) persist(withDerivedSinglesByes(tournamentReducer(state, { type: "SYNC_MATCHES", matches })));
}

function applyRemoteConfig(config: Awaited<ReturnType<typeof fetchRemoteConfig>>) {
  if (!config) return;
  const state = getClientSnapshot();
  persist({ ...state, ...config.state, role: state.role, schemaVersion: SCHEMA_VERSION });
}

function withDerivedSinglesByes(state: AppState): AppState {
  const initial = state.byes.find((bye) => bye.id === "WS-BYE-INITIAL") ?? {
    id: "WS-BYE-INITIAL", category: "womens-singles" as const, teamId: "WS09", skippedRound: "preliminary" as const, intoMatchId: "WS-M6", slot: "away" as const,
  };
  const dynamic: ByeAssignment[] = [];
  const semifinal = state.matches.find((match) => match.id === "WS-SF");
  const final = state.matches.find((match) => match.id === "WS-F");
  if (semifinal?.homeId) dynamic.push({ id: "WS-BYE-ROUND2", category: "womens-singles" as const, teamId: semifinal.homeId, skippedRound: "quarterfinal" as const, intoMatchId: "WS-SF", slot: "home" as const });
  if (final?.homeId) dynamic.push({ id: "WS-BYE-FINAL", category: "womens-singles" as const, teamId: final.homeId, skippedRound: "semifinal" as const, intoMatchId: "WS-F", slot: "home" as const });
  return { ...state, byes: [...state.byes.filter((bye) => bye.category !== "womens-singles"), initial, ...dynamic] };
}

const sharedWriteTypes = new Set<Action["type"]>([
  "START_MATCH", "SCORE_POINT", "UNDO_POINT", "PAUSE_MATCH", "RESUME_MATCH", "COMPLETE_GAME", "COMPLETE_MATCH",
]);
const adminWriteTypes = new Set<Action["type"]>([
  "RESET", "RESET_MATCH", "RESET_CATEGORY", "UPDATE_TEAM", "UPDATE_FIXTURE", "ASSIGN_BYE", "UPDATE_COURT", "UPDATE_TOURNAMENT",
]);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [syncConnected, setSyncConnected] = useState(false);
  const [syncReady, setSyncReady] = useState(!hasSupabaseConfig());
  const [syncPending, setSyncPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    let active = true;
    let unsubscribe = () => {};
    void Promise.all([fetchRemoteMatches(), fetchRemoteConfig()]).then(([rows, config]) => {
      if (active) {
        applyRemoteConfig(config);
        applyRemoteRows(rows);
      }
    }).catch((error: unknown) => {
      if (active) {
        setSyncError(error instanceof Error ? error.message : "Could not load shared scores.");
      }
    }).finally(() => {
      if (!active) return;
      setSyncReady(true);
      unsubscribe = subscribeToRemoteMatches((rows) => applyRemoteRows(rows), (connected) => {
        setSyncConnected(connected);
        if (connected) setSyncError(null);
      }, applyRemoteConfig);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const dispatch = useCallback((action: Action) => {
    const current = getClientSnapshot();
    if (adminWriteTypes.has(action.type)) {
      if (syncPending || !readAdminSession()) {
        setSyncError("A valid admin session is required to change tournament setup.");
        return;
      }
      const next = tournamentReducer(current, action);
      if (next === current) return;
      persist(next);
      setSyncPending(true);
      setSyncError(null);
      void writeRemoteAdminState(current, next).catch(async (error: unknown) => {
        persist(current);
        try {
          applyRemoteConfig(await fetchRemoteConfig());
          applyRemoteRows(await fetchRemoteMatches());
        } catch {}
        setSyncError(error instanceof Error ? error.message : "Admin changes could not be synchronized.");
      }).finally(() => setSyncPending(false));
      return;
    }
    if (sharedWriteTypes.has(action.type)) {
      if (syncPending) return;
      if (!readUmpireSession()) {
        setSyncError("A valid umpire session is required to record scores.");
        return;
      }
      const next = tournamentReducer(current, action);
      if (next === current) return;
      const changed = next.matches.filter((match) => {
        const previous = current.matches.find((item) => item.id === match.id);
        return JSON.stringify(previous) !== JSON.stringify(match);
      });
      persist(next);
      setSyncPending(true);
      setSyncError(null);
      const controllerMatchId = "matchId" in action ? action.matchId : "";
      void writeRemoteMatches(controllerMatchId, changed)
        .then((result) => {
          if (result.matches?.length) applyRemoteRows(result.matches);
        })
        .catch(async (error: unknown) => {
          persist(current);
          try {
            applyRemoteRows(await fetchRemoteMatches());
          } catch {
            // The local rollback is already in place; keep it until the service reconnects.
          }
          setSyncError(error instanceof Error ? error.message : "Score could not be synchronized.");
        })
        .finally(() => setSyncPending(false));
      return;
    }
    persist(tournamentReducer(current, action));
  }, [syncPending]);
  const value = useMemo(() => ({ state, dispatch, syncConnected, syncReady, syncPending, syncError }), [state, dispatch, syncConnected, syncReady, syncPending, syncError]);
  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
  const value = useContext(TournamentContext);
  if (!value) throw new Error("useTournament must be used within TournamentProvider");
  return value;
}
