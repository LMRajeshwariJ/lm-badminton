"use client";

import Link from "next/link";
import { useState } from "react";
import { Progression } from "@/components/bracket/progression";
import { StatusBadge } from "@/components/common/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournament } from "@/context/tournament-context";
import { mainRounds, validateCategory } from "@/lib/bracket";
import { CATEGORY_META, ROUND_LABEL } from "@/lib/constants";
import { currentGame, gameWins, sideName } from "@/lib/utils";
import type { ByeAssignment, CategoryId, Match, RoundId, Team } from "@/types";

export function BracketView() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Knockout</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Brackets</h1>
        <p className="mt-3 text-muted">
          Both titles are single elimination. Winners move forward when a match is completed. Byes are marked, and nobody is given a second fixture for the same step.
        </p>
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
  const check = validateCategory(category, state.teams, state.matches, state.byes);
  const rounds = mainRounds(category);
  const [round, setRound] = useState<RoundId>("preliminary");
  const final = matches.find((match) => match.round === "final");
  const champion = final?.winnerId ? state.teams.find((team) => team.id === final.winnerId) : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Progression category={category} matches={state.matches} byes={state.byes} />
        <Explanation category={category} ok={check.ok} issues={check.issues} />
      </div>
      <Preliminary category={category} matches={matches} byes={byes} teams={state.teams} />
      <div className="lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["preliminary", ...rounds] as RoundId[]).map((item) => (
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
          {matches
            .filter((match) => match.round === round)
            .map((match) => (
              <BracketCard key={match.id} match={match} teams={state.teams} byes={byes} />
            ))}
        </div>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <DesktopTree rounds={rounds} matches={matches} teams={state.teams} byes={byes} champion={champion} />
      </div>
    </div>
  );
}

function Explanation({ category, ok, issues }: { category: CategoryId; ok: boolean; issues: string[] }) {
  return (
    <article className="rounded-3xl border border-line bg-surface-2 p-5 sm:p-6">
      <h2 className="font-display text-2xl">{category === "mixed-doubles" ? "18 teams, then a round of 16" : "Why the byes sit up front"}</h2>
      {category === "mixed-doubles" ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          Eighteen teams is two more than a round of 16. Fourteen teams receive an opening bye and go straight into the round of 16. The other four play two preliminary matches, and those winners join them. A bye is not turned into an extra match.
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">
          Nine players cannot fill a later round without a play-in or an invented opponent. Scattering byes through the quarterfinals and semifinals would leave an odd count, so someone would have to advance twice or a match would be short a player. This draw uses one preliminary match and seven opening byes. Eight players then play a standard quarterfinal, semifinal, and final. That keeps a single champion and gives nobody two matches in the same round. Byes can still be moved by hand later, as long as the path stays valid single elimination.
        </p>
      )}
      {ok ? (
        <p className="mt-4 text-sm font-semibold text-accent">
          Draw checked · {CATEGORY_META[category].fieldSize} {CATEGORY_META[category].entryNoun} · {CATEGORY_META[category].byeCount} byes · one champion path
        </p>
      ) : (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-danger">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Preliminary({
  category,
  matches,
  byes,
  teams,
}: {
  category: CategoryId;
  matches: Match[];
  byes: ByeAssignment[];
  teams: Team[];
}) {
  const prelim = matches.filter((match) => match.round === "preliminary");
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Preliminary</h2>
          <p className="text-sm text-muted">
            {prelim.length} {prelim.length === 1 ? "match" : "matches"} · {byes.length} byes
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {prelim.map((match) => (
          <BracketCard key={match.id} match={match} teams={teams} byes={byes} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {byes.map((bye) => {
          const team = teams.find((item) => item.id === bye.teamId);
          return (
            <span key={bye.id} className="rounded-full border border-line bg-background px-3 py-1 text-sm">
              <span className="text-accent">Bye</span> {team?.name} → {ROUND_LABEL[category === "mixed-doubles" ? "round-of-16" : "quarterfinal"]}
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
  byes,
  champion,
}: {
  rounds: RoundId[];
  matches: Match[];
  teams: Team[];
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
                    <BracketCard match={match} teams={teams} byes={byes} />
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

function BracketCard({ match, teams, byes }: { match: Match; teams: Team[]; byes: ByeAssignment[] }) {
  const wins = gameWins(match);
  const live = currentGame(match);
  const home = match.status === "live" && live ? live.home : match.status === "completed" ? wins.home : null;
  const away = match.status === "live" && live ? live.away : match.status === "completed" ? wins.away : null;
  const homeBye = byes.some((bye) => bye.teamId === match.homeId && bye.intoMatchId === match.id);
  const awayBye = byes.some((bye) => bye.teamId === match.awayId && bye.intoMatchId === match.id);

  return (
    <Link href={`/live/${match.id}`} className="block w-full rounded-2xl border border-line bg-background px-3 py-2 transition hover:border-accent/50">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{ROUND_LABEL[match.round]}</span>
        <StatusBadge status={match.status} />
      </div>
      <Slot name={sideName(match, "home", teams)} score={home} bye={homeBye} winner={match.winnerId !== null && match.winnerId === match.homeId} />
      <Slot name={sideName(match, "away", teams)} score={away} bye={awayBye} winner={match.winnerId !== null && match.winnerId === match.awayId} />
    </Link>
  );
}

function Slot({ name, score, bye, winner }: { name: string; score: number | null; bye: boolean; winner: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 text-sm ${winner ? "text-accent" : ""}`}>
      <span className="truncate">
        {name}
        {bye ? <span className="ml-1 text-[10px] uppercase tracking-[0.12em] text-sky">Bye</span> : null}
      </span>
      <span className="font-display tabular-nums">{score === null ? "" : score}</span>
    </div>
  );
}
