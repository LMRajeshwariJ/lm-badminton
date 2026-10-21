"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Radio } from "lucide-react";
import { FloatingShuttle } from "@/components/common/shuttle";
import { MatchCard } from "@/components/scoreboard/match-card";
import { Button } from "@/components/ui/button";
import { useTournament } from "@/context/tournament-context";
import { formatKickoff, formatTournamentDates } from "@/lib/utils";

export function HomePage() {
  const reduce = useReducedMotion();
  const { state } = useTournament();
  const live = state.matches.filter((match) => match.status === "live");
  const upcoming = state.matches
    .filter((match) => match.status === "upcoming" && match.homeId && match.awayId && match.scheduledAt)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(0, 4);
  const recent = state.matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
    .slice(0, 4);
  const completed = state.matches.filter((match) => match.status === "completed").length;
  const courtsFree = state.courts.filter((court) => !live.some((match) => match.courtId === court.id)).length;

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="court-grid absolute inset-0" />
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-sky/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-8 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
          <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <h1 className="mt-4 font-display text-6xl leading-[0.88] tracking-tight sm:text-8xl">
              LM-
              <span className="text-accent">Badminton</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">{state.tournament.edition}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
                <CalendarDays className="h-4 w-4 text-accent" />
                {formatTournamentDates(state.tournament.startDate, state.tournament.endDate)}
              </span>
              <a href={state.tournament.venueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 hover:border-sky/50 hover:text-foreground">
                <MapPin className="h-4 w-4 text-sky" />
                {state.tournament.venue}, {state.tournament.city}
              </a>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-accent">
                <Radio className="h-4 w-4" />
                {state.tournament.status === "live" ? "Tournament in progress" : state.tournament.status}
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/live">
                  Watch live <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/brackets">View draw</Link>
              </Button>
            </div>
          </motion.div>
          <div className="relative">
            <FloatingShuttle className="absolute right-6 top-4 z-10" />
            <div className="space-y-3 pt-16">
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
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-3 px-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat value={String(state.teams.filter((team) => team.category === "mixed-doubles").length)} label="Doubles teams" />
        <Stat value="9" label="Women's singles" />
        <Stat value={String(live.length)} label="Live matches" />
        <Stat value={String(completed)} label="Completed" />
        <Stat value={`${courtsFree}/${state.courts.length}`} label="Courts free" />
      </section>

      <section className="mx-auto mt-12 max-w-7xl px-4">
        <SectionTitle title="Live" href="/live" action="All" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
      </section>

      <section className="mx-auto mt-12 grid max-w-7xl gap-8 px-4 lg:grid-cols-2">
        <div>
          <SectionTitle title="Upcoming" href="/brackets" action="Draw" />
          <div className="mt-4 space-y-3">
            {upcoming.map((match) => (
              <Link key={match.id} href={`/live/${match.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-white/20">
                <div>
                  <p className="font-semibold">
                    {state.teams.find((team) => team.id === match.homeId)?.name} vs {state.teams.find((team) => team.id === match.awayId)?.name}
                  </p>
                  <p className="text-sm text-muted">{formatKickoff(match.scheduledAt)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle title="Results" href="/brackets" action="Draw" />
          <div className="mt-4 grid gap-3">
            {recent.map((match) => (
              <MatchCard key={match.id} match={match} teams={state.teams} players={state.players} courtName={state.courts.find((court) => court.id === match.courtId)?.name} />
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-4">
      <p className="font-display text-3xl tabular-nums text-accent">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

function SectionTitle({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h2>
      <Link href={href} className="shrink-0 text-sm font-semibold text-accent">
        {action}
      </Link>
    </div>
  );
}
