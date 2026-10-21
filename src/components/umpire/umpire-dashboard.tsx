"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/common/category-badge";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META, ROUND_LABEL } from "@/lib/constants";
import { claimMatch, hasSupabaseConfig, readScoringSession } from "@/lib/supabase";
import { currentGame, gameWins, playerLine, sideName, teamPlayers } from "@/lib/utils";
import type { Match, Side } from "@/types";

const groups = [
  { id: "scheduled", label: "Scheduled" },
  { id: "live", label: "In Progress" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
] as const;

export function UmpireDashboard() {
  const { state, syncError, syncReady } = useTournament();
  const router = useRouter();
  const [starting, setStarting] = useState<Match | null>(null);
  const [message, setMessage] = useState("");
  const [viewOnlyIds, setViewOnlyIds] = useState<Set<string>>(new Set());
  const authorized = Boolean(readScoringSession());

  async function takeControl(match: Match) {
    setMessage("");
    try {
      await claimMatch(match.id);
      router.push(`/umpire/match/${match.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not take control of the match.");
      setViewOnlyIds((current) => new Set(current).add(match.id));
    }
  }

  const categorized = {
    scheduled: state.matches.filter((match) => match.status === "upcoming"),
    live: state.matches.filter((match) => match.status === "live" && !match.paused),
    paused: state.matches.filter((match) => match.status === "live" && match.paused),
    completed: state.matches.filter((match) => match.status === "completed"),
  };

  if (!hasSupabaseConfig()) {
    return <SetupNotice />;
  }

  if (!authorized) {
    return (
      <SetupNotice title="Scoring session required" body="Choose Umpire or Admin in the header and enter the password before managing matches." />
    );
  }

  if (!syncReady) {
    return <SetupNotice title="Loading shared matches" body="Connecting to the tournament score database before enabling umpire controls." />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Public tournament</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent"><ShieldCheck className="h-4 w-4" /> Umpire</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Matches</h1>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2"><Radio className="h-4 w-4 text-accent" /> Sync on</span>
        </div>
      </header>
      {message || syncError ? <p role="alert" className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{message || syncError}</p> : null}
      <div className="mt-8 space-y-8">
        {groups.map((group) => (
          <section key={group.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl">{group.label}</h2>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">{categorized[group.id].length}</span>
            </div>
            {categorized[group.id].length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {categorized[group.id]
                  .slice()
                  .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
                  .map((match) => (
                    <UmpireMatchCard
                      key={match.id}
                      match={match}
                      onStart={() => setStarting(match)}
                      onTakeControl={() => void takeControl(match)}
                      viewOnly={viewOnlyIds.has(match.id)}
                    />
                  ))}
              </div>
            ) : <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">No matches in this group.</p>}
          </section>
        ))}
      </div>
      {starting ? <StartMatchDialog match={starting} close={() => setStarting(null)} /> : null}
    </div>
  );
}

function UmpireMatchCard({ match, onStart, onTakeControl, viewOnly }: { match: Match; onStart: () => void; onTakeControl: () => void; viewOnly: boolean }) {
  const { state } = useTournament();
  const home = state.teams.find((team) => team.id === match.homeId);
  const away = state.teams.find((team) => team.id === match.awayId);
  const wins = gameWins(match);
  const current = currentGame(match);
  const groups = match.status === "completed" ? `${wins.home}–${wins.away} games` : current ? `Game ${match.games.filter((game) => game.winner).length + 1} · ${current.home}–${current.away}` : "No score yet";
  return (
    <article className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={match.category} />
        <span className="text-xs text-muted">Match {match.id.split("-").at(-1)?.toUpperCase()}</span>
        <span className="text-xs text-muted">{ROUND_LABEL[match.round]}</span>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${match.status === "completed" ? "bg-white/10 text-muted" : match.paused ? "bg-sky/15 text-sky" : match.status === "live" ? "bg-accent/15 text-accent" : "bg-white/5 text-muted"}`}>
          {match.status === "live" ? match.paused ? "Paused" : "In progress" : match.status}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0"><p className="truncate font-display text-xl">{sideName(match, "home", state.teams)}</p><p className="truncate text-xs text-muted">{playerLine(home, state.players)}</p></div>
        <span className="text-xs text-muted">vs</span>
        <div className="min-w-0 text-right"><p className="truncate font-display text-xl">{sideName(match, "away", state.teams)}</p><p className="truncate text-xs text-muted">{playerLine(away, state.players)}</p></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm text-muted">
        <span>{state.courts.find((court) => court.id === match.courtId)?.name ?? "Court to assign"}</span>
        <span className="font-semibold tabular-nums text-foreground">{groups}</span>
      </div>
      <div className="mt-4 flex justify-end">
        {match.status === "upcoming" ? (
          <Button onClick={onStart} disabled={!match.homeId || !match.awayId}><Radio className="h-4 w-4" /> Start match</Button>
        ) : match.status === "completed" ? (
          <Button asChild variant="outline"><Link href={`/live/${match.id}`}>View result <ArrowRight className="h-4 w-4" /></Link></Button>
        ) : (
          viewOnly ? <Button asChild variant="outline"><Link href={`/live/${match.id}`}>View match <ArrowRight className="h-4 w-4" /></Link></Button> : <Button onClick={onTakeControl}>{match.paused ? "Resume match" : "Continue scoring"} <ArrowRight className="h-4 w-4" /></Button>
        )}
      </div>
    </article>
  );
}

function StartMatchDialog({ match, close }: { match: Match; close: () => void }) {
  const { state, dispatch } = useTournament();
  const router = useRouter();
  const [courtId, setCourtId] = useState(match.courtId ?? state.courts.find((court) => !state.matches.some((other) => other.status === "live" && other.courtId === court.id))?.id ?? "");
  const [servingSide, setServingSide] = useState<Side>("home");
  const homeTeam = state.teams.find((team) => team.id === match.homeId);
  const awayTeam = state.teams.find((team) => team.id === match.awayId);
  const [serverId, setServerId] = useState(homeTeam?.playerIds[0] ?? "");
  const [receiverId, setReceiverId] = useState(awayTeam?.playerIds[0] ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const servingTeam = servingSide === "home" ? homeTeam : awayTeam;
  const receivingTeam = servingSide === "home" ? awayTeam : homeTeam;
  const server = servingTeam?.playerIds.includes(serverId) ? serverId : servingTeam?.playerIds[0] ?? "";
  const receiver = receivingTeam?.playerIds.includes(receiverId) ? receiverId : receivingTeam?.playerIds[0] ?? "";

  async function start() {
    if (!courtId || !match.homeId || !match.awayId) return;
    setBusy(true);
    setError("");
    try {
      await claimMatch(match.id);
      dispatch({
        type: "START_MATCH",
        matchId: match.id,
        courtId,
        pointsPerGame: match.pointsPerGame,
        maxPoints: match.maxPoints,
        servingSide,
        servingPlayerId: server,
        receivingPlayerId: receiver,
      });
      router.push(`/umpire/match/${match.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start this match.");
    } finally {
      setBusy(false);
    }
  }

  const selectClass = "mt-1 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="start-match-title" className="my-auto w-full max-w-xl rounded-3xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Confirm match</p>
        <h2 id="start-match-title" className="mt-2 font-display text-3xl">Start scoring?</h2>
        <p className="mt-2 text-muted">{sideName(match, "home", state.teams)} vs {sideName(match, "away", state.teams)} · {CATEGORY_META[match.category].label} · {ROUND_LABEL[match.round]}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Court<select className={selectClass} value={courtId} onChange={(event) => setCourtId(event.target.value)}>
            <option value="">Select a free court</option>{state.courts.map((court) => {
              const busy = state.matches.some((other) => other.id !== match.id && other.status === "live" && other.courtId === court.id);
              return <option key={court.id} value={court.id} disabled={busy}>{court.name}{busy ? " · in use" : ""}</option>;
            })}
          </select></label>
          <label className="text-sm font-semibold">First serving side<select className={selectClass} value={servingSide} onChange={(event) => setServingSide(event.target.value as Side)}><option value="home">{sideName(match, "home", state.teams)}</option><option value="away">{sideName(match, "away", state.teams)}</option></select></label>
          {match.category === "mixed-doubles" ? <>
            <label className="text-sm font-semibold">First server<select className={selectClass} value={server} onChange={(event) => setServerId(event.target.value)}>{teamPlayers(servingTeam, state.players).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
            <label className="text-sm font-semibold">Receiver in right court<select className={selectClass} value={receiver} onChange={(event) => setReceiverId(event.target.value)}>{teamPlayers(receivingTeam, state.players).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
          </> : null}
        </div>
        <p className="mt-4 text-sm text-muted">{match.pointsPerGame} points · cap {match.maxPoints} · best of {match.bestOf}. Starting makes this match visible on the public Live page.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={() => void start()} disabled={!courtId || busy}>{busy ? "Starting…" : "Confirm and start"}</Button></div>
      </section>
    </div>
  );
}

function SetupNotice({ title = "Supabase setup required", body = "Shared umpire authorization and scoring need a configured Supabase project. Follow the setup steps in the README, then restart the dev server." }: { title?: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <section className="rounded-3xl border border-line bg-surface p-8 text-center">
        <LockKeyhole className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-4 font-display text-3xl">{title}</h1>
        <p className="mt-2 text-muted">{body}</p>
        <Button asChild className="mt-6" variant="outline"><Link href="/">Back to tournament</Link></Button>
      </section>
    </div>
  );
}
