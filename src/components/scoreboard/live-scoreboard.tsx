"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedScore } from "@/components/common/animated-score";
import { CategoryBadge } from "@/components/common/category-badge";
import { ShuttleIcon } from "@/components/common/shuttle";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { MatchResultBanner } from "@/components/common/match-result-banner";
import { useTournament } from "@/context/tournament-context";
import { ROUND_LABEL } from "@/lib/constants";
import { currentGame, finishedGames, formatClock, formatKickoff, gameWins, playerLine, pointsLabel, sideName, teamPlayers } from "@/lib/utils";

export function LiveScoreboard({ matchId }: { matchId: string }) {
  const { state, syncReady } = useTournament();
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="That match is not on the board" body="It may have been reset or removed. Head back to the live matches." />
        <Link href="/live" className="mt-6 inline-flex text-sm font-semibold text-accent">
          Back to live matches
        </Link>
      </div>
    );
  }

  const court = state.courts.find((item) => item.id === match.courtId);
  const liveGame = currentGame(match);
  const wins = gameWins(match);
  const homeName = sideName(match, "home", state.teams);
  const awayName = sideName(match, "away", state.teams);
  const servingTeam = state.teams.find((team) => team.id === (match.serving === "home" ? match.homeId : match.awayId));
  const servingPlayer = teamPlayers(servingTeam, state.players).find((player) => player.id === match.servingPlayerId)?.name ?? "";
  const winnerName = match.winnerId ? state.teams.find((team) => team.id === match.winnerId)?.name ?? null : null;
  const nextMatch = match.nextMatchId ? state.matches.find((item) => item.id === match.nextMatchId) : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/live" className="text-sm font-semibold text-muted hover:text-foreground">
        All matches
      </Link>
      <section className="relative mt-4 overflow-hidden rounded-[2rem] border border-line bg-surface">
        <div className="court-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative border-b border-line px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={match.category} />
            <StatusBadge status={match.status} />
            {match.paused ? <span className="text-xs font-semibold uppercase tracking-[0.14em] text-sky">Paused</span> : null}
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-5xl">
            {court ? court.name : "Court to be assigned"}
            <span className="mt-1 block text-lg font-medium text-muted sm:text-2xl">
              {ROUND_LABEL[match.round]}
              {court ? ` · ${court.label}` : ""}
            </span>
          </h1>
        </div>
        <MatchResultBanner match={match} winnerName={winnerName} nextMatch={nextMatch} syncReady={syncReady} />
        <div className="relative grid sm:grid-cols-2">
          <ScoreSide
            name={homeName}
            players={playerLine(state.teams.find((team) => team.id === match.homeId), state.players)}
            score={match.status === "upcoming" ? null : match.status === "live" && liveGame ? liveGame.home : wins.home}
            serving={match.status === "live" && match.serving === "home"}
            servingPlayer={match.serving === "home" ? servingPlayer : ""}
            games={wins.home}
          />
          <ScoreSide
            name={awayName}
            players={playerLine(state.teams.find((team) => team.id === match.awayId), state.players)}
            score={match.status === "upcoming" ? null : match.status === "live" && liveGame ? liveGame.away : wins.away}
            serving={match.status === "live" && match.serving === "away"}
            servingPlayer={match.serving === "away" ? servingPlayer : ""}
            games={wins.away}
            edge
          />
        </div>
        <p className="relative border-t border-line px-5 py-4 text-center text-sm text-muted sm:text-base">
          {match.status === "upcoming"
            ? formatKickoff(match.scheduledAt)
            : `Game ${match.status === "live" ? finishedGames(match).length + 1 : finishedGames(match).length} · ${pointsLabel(match)}`}
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">Games</h2>
          {finishedGames(match).length === 0 && match.status !== "live" ? (
            <p className="mt-3 text-sm text-muted">This fixture has not started. The umpire will set the court and the points before the first rally.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {match.games.map((game, index) => (
                <li key={`${match.id}-game-${index}`} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span className="text-sm text-muted">Game {index + 1}</span>
                  <span className="font-display text-2xl tabular-nums">
                    {game.home}–{game.away}
                  </span>
                  <span className="text-sm text-muted">{game.winner ? sideName(match, game.winner, state.teams) : "In play"}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-muted">
            Game wins {wins.home}–{wins.away}. Best of {match.bestOf}, so the first to {Math.ceil(match.bestOf / 2)} games takes the match.
          </p>
        </section>
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">Timeline</h2>
          {match.timeline.length === 0 ? (
            <p className="mt-3 text-sm text-muted">The rally log starts when the match does.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {match.timeline.map((item) => (
                <li key={item.id} className="grid grid-cols-[72px_1fr] gap-3 text-sm">
                  <time className="text-muted">{formatClock(item.at)}</time>
                  <p>{item.text}</p>
                </li>
              ))}
            </ol>
          )}
          <Link href="/brackets" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent">
            See the bracket path <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function ScoreSide({
  name,
  players,
  score,
  serving,
  servingPlayer,
  games,
  edge = false,
}: {
  name: string;
  players: string;
  score: number | null;
  serving: boolean;
  servingPlayer: string;
  games: number;
  edge?: boolean;
}) {
  return (
    <div className={`px-5 py-8 text-center sm:px-8 sm:py-12 ${edge ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{serving ? `Serving${servingPlayer ? ` · ${servingPlayer}` : ""}` : "Games won " + games}</p>
      <h2 className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">{name}</h2>
      {players ? <p className="mt-1 text-sm text-muted">{players}</p> : null}
      <div className="mt-6 flex items-center justify-center gap-3 font-display text-7xl sm:text-8xl">
        {serving ? <ShuttleIcon className="h-8 w-8 text-accent" /> : <span className="w-8" />}
        {score === null ? <span className="text-muted">–</span> : <AnimatedScore value={score} />}
      </div>
    </div>
  );
}
