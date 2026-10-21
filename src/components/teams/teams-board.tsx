"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournament } from "@/context/tournament-context";
import { buildStandings } from "@/lib/standings";
import { teamPlayers } from "@/lib/utils";
import type { CategoryId } from "@/types";

export function TeamsBoard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="max-w-2xl">
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Teams</h1>
      </header>
      <Tabs defaultValue="mixed-doubles" className="mt-8">
        <TabsList>
          <TabsTrigger value="mixed-doubles">Mixed Doubles · 18</TabsTrigger>
          <TabsTrigger value="womens-singles">Women&apos;s Singles · 9</TabsTrigger>
        </TabsList>
        <TabsContent value="mixed-doubles">
          <TeamGrid category="mixed-doubles" />
        </TabsContent>
        <TabsContent value="womens-singles">
          <TeamGrid category="womens-singles" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TeamGrid({ category }: { category: CategoryId }) {
  const { state } = useTournament();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => buildStandings(category, state.teams, state.matches, state.byes), [category, state.byes, state.matches, state.teams]);
  const visible = rows.filter((row) => {
    const players = teamPlayers(row.team, state.players)
      .map((player) => `${player.name} ${player.department}`)
      .join(" ");
    const haystack = `${row.team.name} ${players}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div>
      <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm">
        <Search className="h-4 w-4 text-muted" />
        <span className="sr-only">Search teams</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={category === "mixed-doubles" ? "Search teams or players" : "Search players"}
          className="w-full bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No one matches that search.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => {
            const people = teamPlayers(row.team, state.players);
            return (
              <article key={row.team.id} className="rounded-3xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Seed {row.team.seed}</p>
                    <h2 className="mt-1 font-display text-2xl tracking-tight">{row.team.name}</h2>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${row.alive ? "bg-accent text-[#101608]" : "bg-white/5 text-muted"}`}>
                    {row.stage}
                  </span>
                </div>
                <ul className="mt-4 space-y-1 text-sm">
                  {people.map((player) => (
                    <li key={player.id}>
                      {player.name}
                      <span className="text-muted"> · {player.department}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Played" value={row.played} />
                  <Stat label="Won" value={row.won} />
                  <Stat label="Diff" value={row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff} />
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-background px-2 py-3">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="font-display text-xl tabular-nums">{value}</dd>
    </div>
  );
}
