"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, History, LockKeyhole, Pause, Play, Radio, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META, ROUND_LABEL } from "@/lib/constants";
import { claimMatch, readUmpireSession, releaseMatch, renewMatchLease } from "@/lib/supabase";
import { currentGame, gameWins, playerLine, sideName, teamPlayers } from "@/lib/utils";
import type { Match, Side } from "@/types";

const faultReasons = ["Foot fault", "Service too high", "Service action", "Receiver not ready", "Racket or body contact", "Other fault"];

export function ScoringConsole({ matchId }: { matchId: string }) {
  const { state, dispatch, syncConnected, syncReady, syncPending, syncError } = useTournament();
  const router = useRouter();
  const match = state.matches.find((item) => item.id === matchId);
  const [controller, setController] = useState(false);
  const [ready, setReady] = useState(false);
  const [controlError, setControlError] = useState("");
  const [faultOpen, setFaultOpen] = useState(false);
  const [faultKind, setFaultKind] = useState<"service-fault" | "fault">("fault");
  const [faultBy, setFaultBy] = useState<Side>("home");
  const [faultReason, setFaultReason] = useState(faultReasons[0]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!syncReady) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!readUmpireSession()) {
        if (active) setControlError("Enter the shared umpire code to take control. You can still view this match as a spectator.");
        return;
      }
      await claimMatch(matchId);
      if (active) {
        setController(true);
        setControlError("");
      }
    }).catch((error: unknown) => {
      if (active) setControlError(error instanceof Error ? error.message : "Another umpire controls this match.");
    }).finally(() => active && setReady(true));
    return () => { active = false; };
  }, [matchId, syncReady]);

  useEffect(() => {
    if (!controller || !match || match.status !== "live") return;
    const interval = setInterval(() => {
      void renewMatchLease(matchId).catch(async (error: unknown) => {
        try {
          await claimMatch(matchId);
          setController(true);
          setControlError("");
        } catch (reclaimError) {
          const message = reclaimError instanceof Error ? reclaimError.message : error instanceof Error ? error.message : "Match control could not be renewed.";
          if (/failed to fetch|network|timeout/i.test(message)) {
            setControlError("Connection interrupted. Reconnecting to renew match control.");
            return;
          }
          setController(false);
          setControlError(message);
        }
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [controller, match, matchId]);

  useEffect(() => {
    if (!match?.startedAt || match.status !== "live") return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(match.startedAt!).getTime()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match?.startedAt, match?.status]);

  const award = useCallback((side: Side, action: "rally" | "service-fault" | "fault" = "rally", offender?: Side, reason?: string) => {
    if (!controller || !match || match.status !== "live" || match.paused || syncPending) return;
    dispatch({ type: "SCORE_POINT", matchId, side, action, faultBy: offender, faultReason: reason });
    setFaultOpen(false);
  }, [controller, dispatch, match, matchId, syncPending]);

  useEffect(() => {
    if (!controller || !match || match.status !== "live" || syncPending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "1") award("home");
      if (event.key === "2") award("away");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: "UNDO_POINT", matchId });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller, match, syncPending, matchId, dispatch, award]);

  useEffect(() => {
    if (!match || match.status !== "completed" || !controller || syncPending) return;
    void releaseMatch(matchId).finally(() => setController(false));
  }, [match, matchId, controller, syncPending]);

  const exit = useCallback(async () => {
    if (controller) await releaseMatch(matchId).catch(() => undefined);
    router.push("/umpire");
  }, [controller, matchId, router]);

  const blockedUndo = useMemo(() => {
    if (!match) return false;
    const previous = match.history.at(-1);
    if (!previous?.advancement) return false;
    const downstream = state.matches.find((item) => item.id === previous.advancement?.matchId);
    return Boolean(downstream && (downstream.status !== "upcoming" || downstream.games.length > 0));
  }, [match, state.matches]);

  if (!match) {
    return <div className="mx-auto max-w-2xl px-4 py-16"><p className="text-muted">This match is not on the board.</p><Link href="/umpire" className="mt-4 inline-flex text-accent">Back to Umpire desk</Link></div>;
  }

  const home = state.teams.find((team) => team.id === match.homeId);
  const away = state.teams.find((team) => team.id === match.awayId);
  const homeName = sideName(match, "home", state.teams);
  const awayName = sideName(match, "away", state.teams);
  const game = currentGame(match) ?? (match.status === "completed" ? match.games.at(-1) : null);
  const wins = gameWins(match);
  const locked = !controller || !ready || syncPending || match.status !== "live" || match.paused;
  const servePlayerId = match.servingPlayerId;
  const serveTeam = match.serving === "home" ? home : away;
  const servePlayer = teamPlayers(serveTeam, state.players).find((player) => player.id === servePlayerId)?.name ?? (serveTeam ? teamPlayers(serveTeam, state.players)[0]?.name : "");
  const serviceCourt = match.serving && game ? (game[match.serving] % 2 === 0 ? "Right court" : "Left court") : "";
  const title = `${homeName} vs ${awayName}`;
  return (
    <div className="min-h-[calc(100svh-5rem)] bg-background">
      <header className="sticky top-0 z-30 border-b border-line bg-background/95 px-3 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button type="button" onClick={() => void exit()} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted hover:bg-white/5 hover:text-foreground"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Umpire desk</span><span className="sm:hidden">Exit</span></button>
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.15em] text-muted">{CATEGORY_META[match.category].label} · {ROUND_LABEL[match.round]} · {state.courts.find((court) => court.id === match.courtId)?.name ?? "Court not set"}</p>
            <p className="truncate font-display text-lg sm:text-xl">{title}</p>
          </div>
          <div className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${syncConnected ? "bg-accent/10 text-accent" : "bg-sky/10 text-sky"}`} title={syncConnected ? "Realtime connected" : "Waiting for realtime connection"}>
            {syncConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{syncConnected ? "Synced" : "Reconnecting"}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        {!controller && ready ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky/20 bg-sky/10 px-4 py-3 text-sm text-sky"><span>{controlError || "Read-only match view. Another umpire has control."}</span><Link href={`/live/${match.id}`} className="font-semibold underline">Public view</Link></div> : null}
        {syncError ? <p role="alert" className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{syncError}</p> : null}
        {match.status === "completed" ? <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 font-display text-lg text-[#101608]"><Check className="h-5 w-5" /> Match complete · {sideName(match, match.winnerId === match.homeId ? "home" : "away", state.teams)} win</div> : null}
        {match.paused ? <div className="mb-4 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-center font-display text-lg text-sky">Match paused</div> : null}

        <section className="grid gap-3 sm:grid-cols-2">
          <ScorePanel side="home" name={homeName} players={playerLine(home, state.players)} score={game?.home ?? 0} games={wins.home} serving={match.serving === "home"} servingPlayer={match.serving === "home" ? servePlayer : ""} serviceCourt={match.serving === "home" ? serviceCourt : ""} positionNames={positionsNames(match, "home", state.players)} />
          <ScorePanel side="away" name={awayName} players={playerLine(away, state.players)} score={game?.away ?? 0} games={wins.away} serving={match.serving === "away"} servingPlayer={match.serving === "away" ? servePlayer : ""} serviceCourt={match.serving === "away" ? serviceCourt : ""} positionNames={positionsNames(match, "away", state.players)} />
        </section>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" /> {formatDuration(elapsed)}</span>
          <span>Game {Math.max(1, match.games.filter((item) => item.winner).length + (match.status === "completed" ? 0 : 1))} · Best of {match.bestOf}</span>
          <span>Game wins <strong className="text-foreground tabular-nums">{wins.home}–{wins.away}</strong></span>
          {match.serving ? <span className="font-semibold text-accent">Serve · {match.serving === "home" ? homeName : awayName}{servePlayer ? ` · ${servePlayer}` : ""} · {serviceCourt}</span> : null}
        </div>

        {match.status === "live" ? (
          <section className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button className="min-h-[5rem] justify-center rounded-2xl text-xl sm:min-h-24 sm:text-2xl" disabled={locked} onClick={() => award("home")}>
              +1 · {homeName}<span className="hidden text-sm opacity-70 sm:inline"> · key 1</span>
            </Button>
            <Button variant="sky" className="min-h-[5rem] justify-center rounded-2xl text-xl sm:min-h-24 sm:text-2xl" disabled={locked} onClick={() => award("away")}>
              +1 · {awayName}<span className="hidden text-sm opacity-70 sm:inline"> · key 2</span>
            </Button>
          </section>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-3">
          <Button variant="outline" size="lg" disabled={locked || !match.history.length || blockedUndo} onClick={() => dispatch({ type: "UNDO_POINT", matchId })} title={blockedUndo ? "The next match has started; this advancement can no longer be undone." : "Undo the latest scoring action"}><RotateCcw className="h-4 w-4" /> Undo</Button>
          {match.status === "live" ? <>
            <Button variant="outline" size="lg" disabled={locked} onClick={() => { setFaultKind("fault"); setFaultBy("home"); setFaultOpen(true); }}><LockKeyhole className="h-4 w-4" /> Fault</Button>
            <Button variant="outline" size="lg" disabled={locked} onClick={() => { setFaultKind("service-fault"); setFaultBy("home"); setFaultOpen(true); }}>Service fault</Button>
            {controller ? match.paused ? <Button size="lg" disabled={syncPending} onClick={() => dispatch({ type: "RESUME_MATCH", matchId })}><Play className="h-4 w-4" /> Resume</Button> : <Button variant="outline" size="lg" disabled={syncPending} onClick={() => dispatch({ type: "PAUSE_MATCH", matchId })}><Pause className="h-4 w-4" /> Pause</Button> : null}
          </> : null}
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-white/5"><History className="h-4 w-4" /> Match history</summary>
            <div className="absolute right-0 top-12 z-20 max-h-[55vh] w-[min(24rem,90vw)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl">
              {match.timeline.length ? <ol className="space-y-3">{[...match.timeline].reverse().map((event) => <li key={event.id} className="grid grid-cols-[5rem_1fr] gap-3 text-sm"><time className="text-xs text-muted">{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(event.at))}</time><span>{event.text}{event.faultReason ? <span className="block text-xs text-muted">{event.faultReason}</span> : null}</span></li>)}</ol> : <p className="text-sm text-muted">No scoring events recorded.</p>}
            </div>
          </details>
        </div>

        <section className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl">Game scores</h2>
          <div className="mt-3 flex flex-wrap gap-2">{match.games.map((item, index) => <span key={`${match.id}-g${index}`} className={`rounded-xl px-3 py-2 text-sm tabular-nums ${item.winner ? "bg-white/10 text-foreground" : "bg-accent/10 text-accent"}`}>Game {index + 1} · {item.home}–{item.away}{item.winner ? ` · ${item.winner === "home" ? homeName : awayName}` : " · in play"}</span>)}</div>
        </section>
      </main>

      {faultOpen ? <FaultDialog
        homeName={homeName}
        awayName={awayName}
        kind={faultKind}
        setKind={setFaultKind}
        offender={faultBy}
        setOffender={setFaultBy}
        reason={faultReason}
        setReason={setFaultReason}
        close={() => setFaultOpen(false)}
        submit={() => award(faultBy === "home" ? "away" : "home", faultKind, faultBy, faultReason)}
      /> : null}
    </div>
  );
}

function ScorePanel({ side, name, players, score, games, serving, servingPlayer, serviceCourt, positionNames }: { side: Side; name: string; players: string; score: number; games: number; serving: boolean; servingPlayer: string; serviceCourt: string; positionNames: string[] }) {
  return (
    <article className={`relative overflow-hidden rounded-3xl border p-4 text-center sm:p-6 ${serving ? "border-accent/50 bg-accent/5" : "border-line bg-surface"}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted"><span>{side === "home" ? "Side A" : "Side B"}</span><span>{games} {games === 1 ? "game" : "games"}</span></div>
      <h1 className="mt-3 font-display text-2xl tracking-tight sm:text-3xl">{name}</h1>
      {players ? <p className="mt-1 min-h-5 text-sm text-muted">{players}</p> : <div className="min-h-5" />}
      <p className={`mt-2 font-display text-[6rem] leading-none tabular-nums sm:text-[8rem] ${serving ? "text-accent" : "text-foreground"}`} aria-label={`${name}: ${score}`}>{score}</p>
      {serving ? <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent"><Radio className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Serving{servingPlayer ? ` · ${servingPlayer}` : ""}{serviceCourt ? ` · ${serviceCourt}` : ""}</span></div> : <div className="mt-2 min-h-7" />}
      {positionNames.length === 2 ? <p className="mt-3 text-[11px] text-muted">Right: {positionNames[0]} · Left: {positionNames[1]}</p> : null}
    </article>
  );
}

function positionsNames(match: Match, side: Side, players: { id: string; name: string }[]) {
  const positions = match.positions?.[side];
  if (!positions) return [];
  return [positions.right, positions.left].map((id) => players.find((player) => player.id === id)?.name ?? "");
}

function FaultDialog({ homeName, awayName, kind, setKind, offender, setOffender, reason, setReason, close, submit }: {
  homeName: string; awayName: string; kind: "service-fault" | "fault"; setKind: (kind: "service-fault" | "fault") => void;
  offender: Side; setOffender: (side: Side) => void; reason: string; setReason: (reason: string) => void; close: () => void; submit: () => void;
}) {
  const control = "mt-1 w-full rounded-xl border border-line bg-background px-3 py-3 text-base";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="fault-dialog-title" className="w-full max-w-md rounded-3xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky">Point awarded to opponent</p>
        <h2 id="fault-dialog-title" className="mt-2 font-display text-3xl">Record a fault</h2>
        <label className="mt-4 block text-sm font-semibold">Fault type<select value={kind} onChange={(event) => setKind(event.target.value as "service-fault" | "fault")} className={control}><option value="fault">Other fault</option><option value="service-fault">Service fault</option></select></label>
        <label className="mt-3 block text-sm font-semibold">Fault committed by<select value={offender} onChange={(event) => setOffender(event.target.value as Side)} className={control}><option value="home">{homeName}</option><option value="away">{awayName}</option></select></label>
        <label className="mt-3 block text-sm font-semibold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className={control}>{faultReasons.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={submit}>Record fault</Button></div>
      </section>
    </div>
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}
