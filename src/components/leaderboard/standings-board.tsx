"use client";

import { Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META } from "@/lib/constants";
import { buildStandings, spotlight, type StandingRow } from "@/lib/standings";
import type { CategoryId } from "@/types";

export function StandingsBoard({ preview = false }: { preview?: boolean }) {
  if (preview) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <PreviewTable category="mixed-doubles" />
        <PreviewTable category="womens-singles" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="max-w-2xl">
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Standings</h1>
      </header>
      <Tabs defaultValue="mixed-doubles" className="mt-8">
        <TabsList>
          <TabsTrigger value="mixed-doubles">Mixed Doubles</TabsTrigger>
          <TabsTrigger value="womens-singles">Women&apos;s Singles</TabsTrigger>
        </TabsList>
        <TabsContent value="mixed-doubles">
          <CategoryStandings category="mixed-doubles" />
        </TabsContent>
        <TabsContent value="womens-singles">
          <CategoryStandings category="womens-singles" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PreviewTable({ category }: { category: CategoryId }) {
  const { state } = useTournament();
  const rows = buildStandings(category, state.teams, state.matches, state.byes).slice(0, 5);
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h3 className="font-display text-2xl">{CATEGORY_META[category].label}</h3>
      <ol className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <li key={row.team.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                <span className="mr-2 text-muted">{index + 1}</span>
                {row.team.name}
              </p>
              <p className="text-sm text-muted">{row.stage}</p>
            </div>
            <p className="font-display tabular-nums text-accent">{signed(row.pointDiff)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CategoryStandings({ category }: { category: CategoryId }) {
  const { state } = useTournament();
  const rows = buildStandings(category, state.teams, state.matches, state.byes);
  const marks = spotlight(rows);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Mark title="Champion" rows={marks.champions} empty="The final is still open." />
        <Mark title="Finalists" rows={marks.finalists} empty="Finalists appear when the last match is set." />
        <Mark title="Semifinalists" rows={marks.semifinalists} empty="Semifinal places open after the quarterfinals." />
      </div>
      <div className="overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              {["#", "Entry", "Stage", "P", "W", "L", "GW", "GL", "PF", "PA", "Diff"].map((heading) => (
                <th key={heading} className="px-3 py-3 font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.team.id} className="border-t border-line bg-background">
                <td className="px-3 py-3 text-muted">{index + 1}</td>
                <td className="px-3 py-3 font-semibold">
                  {row.alive ? <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" /> : null}
                  {row.team.name}
                </td>
                <td className="px-3 py-3">{row.stage}</td>
                <td className="px-3 py-3 tabular-nums">{row.played}</td>
                <td className="px-3 py-3 tabular-nums">{row.won}</td>
                <td className="px-3 py-3 tabular-nums">{row.lost}</td>
                <td className="px-3 py-3 tabular-nums">{row.gamesWon}</td>
                <td className="px-3 py-3 tabular-nums">{row.gamesLost}</td>
                <td className="px-3 py-3 tabular-nums">{row.pointsFor}</td>
                <td className="px-3 py-3 tabular-nums">{row.pointsAgainst}</td>
                <td className="px-3 py-3 font-semibold tabular-nums text-accent">{signed(row.pointDiff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Mark({ title, rows, empty }: { title: string; rows: StandingRow[]; empty: string }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        <Trophy className="h-3.5 w-3.5 text-accent" /> {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {rows.map((row) => (
            <li key={row.team.id} className="font-display text-lg">
              {row.team.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function signed(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}
