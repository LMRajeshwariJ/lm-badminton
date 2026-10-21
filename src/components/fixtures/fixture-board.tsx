"use client";

import { useMemo, useState } from "react";
import { MatchCard } from "@/components/scoreboard/match-card";
import { EmptyState } from "@/components/common/empty-state";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META, ROUND_LABEL, ROUND_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CategoryId, MatchStatus } from "@/types";

type CategoryFilter = "all" | CategoryId;
type StatusFilter = "all" | MatchStatus;

export function FixtureBoard() {
  const { state } = useTournament();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const visible = useMemo(
    () =>
      state.matches.filter((match) => {
        if (category !== "all" && match.category !== category) return false;
        if (status !== "all" && match.status !== status) return false;
        return true;
      }),
    [category, state.matches, status],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="max-w-2xl">
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Fixtures</h1>
      </header>
      <div className="mt-6 flex flex-col gap-3">
        <FilterRow
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { id: "all", label: "Both" },
            { id: "mixed-doubles", label: CATEGORY_META["mixed-doubles"].label },
            { id: "womens-singles", label: CATEGORY_META["womens-singles"].label },
          ]}
        />
        <FilterRow
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { id: "all", label: "All" },
            { id: "live", label: "Live" },
            { id: "upcoming", label: "Upcoming" },
            { id: "completed", label: "Completed" },
          ]}
        />
      </div>
      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No fixtures in this filter" body="Try another category or status. The full draw is still on the bracket page." />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {ROUND_ORDER.map((round) => {
            const matches = visible.filter((match) => match.round === round);
            if (matches.length === 0) return null;
            return (
              <section key={round}>
                <h2 className="font-display text-2xl">{ROUND_LABEL[round]}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      teams={state.teams}
                      players={state.players}
                      courtName={state.courts.find((court) => court.id === match.courtId)?.name}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-semibold",
            value === option.id ? "border-accent bg-accent text-[#101608]" : "border-line text-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
