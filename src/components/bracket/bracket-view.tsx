"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/common/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournament } from "@/context/tournament-context";
import { mainRounds } from "@/lib/bracket";
import { ROUND_LABEL } from "@/lib/constants";
import { currentGame, gameWins, playerLine, sideName } from "@/lib/utils";
import type { ByeAssignment, CategoryId, Match, Player, RoundId, Team } from "@/types";

export function BracketView() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="max-w-3xl">
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Draw</h1>
      </header>
      <Tabs defaultValue="mixed-doubles" className="mt-8">
        <TabsList>
          <TabsTrigger value="mixed-doubles">Mixed Doubles</TabsTrigger>
          <TabsTrigger value="womens-singles">Women&apos;s Singles</TabsTrigger>
        </TabsList>
        <TabsContent value="mixed-doubles">
          <CategoryBracket category="mixed-doubles" />
        </TabsContent>
        <TabsContent value="womens-singles">
          <CategoryBracket category="womens-singles" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoryBracket({ category }: { category: CategoryId }) {
  const { state } = useTournament();
  const matches = state.matches.filter((match) => match.category === category);
  const byes = state.byes.filter((bye) => bye.category === category);
  const visible = matches.filter((match) => state.role !== "audience" || match.round === "preliminary" || match.round === "round-of-16" || Boolean(match.homeId && match.awayId));
  const hasPrelim = visible.some((match) => match.round === "preliminary") || byes.length > 0;
  const rounds = mainRounds(category).filter((item) => visible.some((match) => match.round === item));
  const mobileRounds = hasPrelim ? (["preliminary", ...rounds] as RoundId[]) : rounds;
  const [round, setRound] = useState<RoundId>(mobileRounds[0] ?? "round-of-16");
  const final = matches.find((match) => match.round === "final");
  const champion = final?.winnerId ? state.teams.find((team) => team.id === final.winnerId) : undefined;

  return (
    <div className="space-y-6">
      {hasPrelim ? <Preliminary matches={visible} byes={byes} teams={state.teams} players={state.players} /> : null}
      <div className="lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {mobileRounds.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={round === item}
              onClick={() => setRound(item)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                round === item ? "bg-accent text-[#101608]" : "bg-surface text-muted"
              }`}
            >
              {ROUND_LABEL[item]}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3">
          {visible
            .filter((match) => match.round === round)
            .map((match) => (
              <BracketCard key={match.id} match={match} teams={state.teams} players={state.players} byes={byes} />
            ))}
        </div>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <DesktopTree rounds={rounds} matches={visible} teams={state.teams} players={state.players} byes={byes} champion={champion} />
      </div>
    </div>
  );
}

function Preliminary({
  matches,
  byes,
  teams,
  players,
}: {
  matches: Match[];
  byes: ByeAssignment[];
  teams: Team[];
  players: Player[];
}) {
  const prelim = matches.filter((match) => match.round === "preliminary");
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Opening round</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {prelim.map((match) => (
          <BracketCard key={match.id} match={match} teams={teams} players={players} byes={byes} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {byes.map((bye) => {
          const team = teams.find((item) => item.id === bye.teamId);
          return (
            <span key={bye.id} className="rounded-full border border-line bg-background px-3 py-1 text-sm">
              <span className="text-accent">Bye</span> {team?.name} — advances to the next stage
            </span>
          );
        })}
      </div>
    </section>
  );
}

const BRACKET_ROW = 156;

function DesktopTree({
  rounds,
  matches,
  teams,
  players,
  byes,
  champion,
}: {
  rounds: RoundId[];
  matches: Match[];
  teams: Team[];
  players: Player[];
  byes: ByeAssignment[];
  champion?: Team;
}) {
  const base = matches.filter((match) => match.round === rounds[0]).length || 1;
  return (
    <div className="flex min-w-max items-stretch py-2">
      {rounds.map((round, index) => {
        const column = matches.filter((match) => match.round === round);
        const span = Math.max(1, base / column.length);
        return (
          <div key={round} className="flex">
            <div className="w-[240px]">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{ROUND_LABEL[round]}</p>
              <div className="grid" style={{ gridTemplateRows: `repeat(${base}, ${BRACKET_ROW}px)` }}>
                {column.map((match) => (
                  <div key={match.id} className="flex items-center px-1" style={{ gridRow: `span ${span}` }}>
                    <BracketCard match={match} teams={teams} players={players} byes={byes} />
                  </div>
                ))}
              </div>
            </div>
            {index < rounds.length - 1 ? <Connectors rows={base} span={span} /> : null}
          </div>
        );
      })}
      <div className="flex w-[220px] items-center justify-center">
        <div className="w-full rounded-3xl border border-accent/40 bg-accent/10 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Champion</p>
          <p className="mt-2 font-display text-2xl">{champion?.name ?? "Still open"}</p>
        </div>
      </div>
    </div>
  );
}

function Connectors({ rows, span }: { rows: number; span: number }) {
  const pairs = rows / (span * 2);
  return (
    <div className="grid w-10" style={{ gridTemplateRows: `repeat(${rows}, ${BRACKET_ROW}px)`, marginTop: 28 }}>
      {Array.from({ length: pairs }).map((_, index) => (
        <div key={index} className="relative" style={{ gridRow: `span ${span * 2}` }}>
          <div className="absolute left-0 right-1/2 top-1/4 border-t border-white/20" />
          <div className="absolute left-0 right-1/2 top-3/4 border-t border-white/20" />
          <div className="absolute bottom-1/4 left-1/2 top-1/4 border-l border-white/20" />
          <div className="absolute left-1/2 right-0 top-1/2 border-t border-white/20" />
        </div>
      ))}
    </div>
  );
}

function BracketCard({ match, teams, players, byes }: { match: Match; teams: Team[]; players: Player[]; byes: ByeAssignment[] }) {
  const wins = gameWins(match);
  const live = currentGame(match);
  const home = match.status === "live" && live ? live.home : match.status === "completed" ? wins.home : null;
  const away = match.status === "live" && live ? live.away : match.status === "completed" ? wins.away : null;
  const homeBye = byes.some((bye) => bye.teamId === match.homeId && bye.intoMatchId === match.id);
  const awayBye = byes.some((bye) => bye.teamId === match.awayId && bye.intoMatchId === match.id);

  return (
    <Link href={`/live/${match.id}`} className="block w-full rounded-2xl border border-line bg-background px-3 py-2 transition hover:border-accent/50">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{match.id} · {ROUND_LABEL[match.round]}</span>
        <StatusBadge status={match.status} />
      </div>
      <Slot name={sideName(match, "home", teams)} detail={playerLine(teams.find((team) => team.id === match.homeId), players)} score={home} bye={homeBye} winner={match.winnerId !== null && match.winnerId === match.homeId} />
      <Slot name={sideName(match, "away", teams)} detail={playerLine(teams.find((team) => team.id === match.awayId), players)} score={away} bye={awayBye} winner={match.winnerId !== null && match.winnerId === match.awayId} />
    </Link>
  );
}

function Slot({ name, detail, score, bye, winner }: { name: string; detail: string; score: number | null; bye: boolean; winner: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 text-sm ${winner ? "text-accent" : ""}`}>
      <span className="min-w-0 truncate">
        <span className="block truncate">{name}
        {bye ? <span className="ml-1 text-[10px] uppercase tracking-[0.12em] text-sky">Bye</span> : null}
        </span>
        {detail ? <span className="block truncate text-[10px] text-muted">{detail}</span> : null}
      </span>
      <span className="font-display tabular-nums">{score === null ? "" : score}</span>
    </div>
  );
}
