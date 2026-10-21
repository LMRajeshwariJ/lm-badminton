"use client";

import { EmptyState } from "@/components/common/empty-state";
import { MatchCard } from "@/components/scoreboard/match-card";
import { useTournament } from "@/context/tournament-context";
import { hasSupabaseConfig } from "@/lib/supabase";

export function LiveIndex() {
  const { state, syncReady, syncConnected, syncError } = useTournament();
  const live = state.matches.filter((match) => match.status === "live");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="max-w-2xl">
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Live</h1>
      </header>
      {hasSupabaseConfig() && (!syncConnected || syncError) ? (
        <p role="status" className="mt-5 rounded-2xl border border-sky/20 bg-sky/10 px-4 py-3 text-sm text-sky">
          {syncError ?? (syncReady ? "Reconnecting…" : "Loading scores…")}
        </p>
      ) : null}
      {live.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No live matches" body="Live matches appear here when scoring starts." />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {live.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              teams={state.teams}
              players={state.players}
              courtName={state.courts.find((court) => court.id === match.courtId)?.name}
              featured
            />
          ))}
        </div>
      )}
    </div>
  );
}
