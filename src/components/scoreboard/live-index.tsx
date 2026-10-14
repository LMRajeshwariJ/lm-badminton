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
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Happening now</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Live matches</h1>
        <p className="mt-3 text-muted">{hasSupabaseConfig() ? "Scores update live across connected browsers and devices." : "This demo uses browser-local data until Supabase is configured."}</p>
      </header>
      {hasSupabaseConfig() && (!syncConnected || syncError) ? (
        <p role="status" className="mt-5 rounded-2xl border border-sky/20 bg-sky/10 px-4 py-3 text-sm text-sky">
          {syncError ?? (syncReady ? "Live connection is reconnecting. Scores will catch up automatically." : "Loading the latest shared scores…")}
        </p>
      ) : null}
      {live.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No matches are live" body="When an umpire starts a match, it will show up here with the court and the current game." />
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
