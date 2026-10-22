"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, History, Pause, Play, Radio, RotateCcw, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedScore } from "@/components/common/animated-score";
import { ConfettiBurst } from "@/components/common/confetti-burst";
import { MatchResultBanner } from "@/components/common/match-result-banner";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META, ROUND_LABEL } from "@/lib/constants";
import { claimMatch, readScoringSession } from "@/lib/supabase";
import { gameWinner, gamesNeeded, isGameComplete } from "@/lib/scoring";
import { playTournamentSound } from "@/lib/experience";
import { useLocalBoolean } from "@/hooks/use-local-boolean";
import { currentGame, gameWins, playerLine, sideName, teamPlayers } from "@/lib/utils";
import type { Match, Side } from "@/types";

export function ScoringConsole({ matchId }: { matchId: string }) {
  const { state, dispatch, syncConnected, syncReady, syncPending, syncError } = useTournament();
  const router = useRouter();
  const match = state.matches.find((item) => item.id === matchId);
  const [controller, setController] = useState(false);
  const [ready, setReady] = useState(false);
  const [controlError, setControlError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useLocalBoolean(`lm-umpire-muted:${matchId}`, false);
  const [celebration, setCelebration] = useState<{ kind: "game" | "match"; name: string } | null>(null);

  useEffect(() => {
    if (!syncReady) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!readScoringSession()) {
        if (active) setControlError("Enter an umpire or admin password to take control. You can still view this match as a spectator.");
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
    if (!match?.startedAt || match.status !== "live") return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(match.startedAt!).getTime()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match?.startedAt, match?.status]);

  const award = useCallback((side: Side) => {
    if (!controller || !match || match.status !== "live" || match.paused || syncPending) return;
    const activeGame = currentGame(match);
    let sound: "point" | "game" | "match" = "point";
    if (activeGame) {
      const nextHome = activeGame.home + Number(side === "home");
      const nextAway = activeGame.away + Number(side === "away");
      const winner = gameWinner(nextHome, nextAway, { target: match.pointsPerGame, max: match.maxPoints, winBy: match.winBy });
      if (winner) {
        const wins = gameWins(match);
        const matchWon = wins[winner] + 1 >= gamesNeeded(match.bestOf);
        sound = matchWon ? "match" : "game";
        if (state.experienceSettings.animations && state.experienceSettings.victoryCelebrations) {
          setCelebration({ kind: matchWon ? "match" : "game", name: sideName(match, winner, state.teams) });
          window.setTimeout(() => setCelebration(null), matchWon ? 3000 : 2000);
        }
      }
    }
    playTournamentSound(sound, state.experienceSettings, muted);
    dispatch({ type: "SCORE_POINT", matchId, side });
  }, [controller, dispatch, match, matchId, muted, state.experienceSettings, state.teams, syncPending]);

  const undo = useCallback(() => {
    if (!match?.history.length || syncPending) return;
    playTournamentSound("undo", state.experienceSettings, muted);
    dispatch({ type: "UNDO_POINT", matchId });
  }, [dispatch, match?.history.length, matchId, muted, state.experienceSettings, syncPending]);

  useEffect(() => {
    if (!controller || !match || match.status !== "live" || syncPending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "1") award("home");
      if (event.key === "2") award("away");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller, match, syncPending, award, undo]);

  const exit = useCallback(() => {
    router.push(readScoringSession()?.role === "admin" ? "/admin" : "/umpire");
  }, [router]);

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
  const nextMatch = match.nextMatchId ? state.matches.find((item) => item.id === match.nextMatchId) : undefined;
  return (
    <div className="min-h-[calc(100svh-5rem)] bg-background">
      <header className="sticky top-0 z-30 border-b border-line bg-background/95 px-3 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button type="button" onClick={() => void exit()} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted hover:bg-white/5 hover:text-foreground"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Umpire desk</span><span className="sm:hidden">Exit</span></button>
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.15em] text-muted">{CATEGORY_META[match.category].label} · {ROUND_LABEL[match.round]} · {state.courts.find((court) => court.id === match.courtId)?.name ?? "Court not set"}</p>
            <p className="truncate font-display text-lg sm:text-xl">{title}</p>
          </div>
          <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setMuted(!muted)} title={muted ? "Turn scoring sounds on" : "Mute scoring sounds"} aria-label={muted ? "Turn scoring sounds on" : "Mute scoring sounds"}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button><div className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${syncConnected ? "bg-accent/10 text-accent" : "bg-sky/10 text-sky"}`} title={syncConnected ? "Realtime connected" : "Waiting for realtime connection"}>{syncConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{syncConnected ? "Synced" : "Reconnecting"}</span></div></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        {!controller && ready ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky/20 bg-sky/10 px-4 py-3 text-sm text-sky"><span>{controlError || "Read-only match view. Another umpire has control."}</span><Link href={`/live/${match.id}`} className="font-semibold underline">Public view</Link></div> : null}
        {syncError ? <p role="alert" className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{syncError}</p> : null}
        <MatchResultBanner match={match} winnerName={match.winnerId ? sideName(match, match.winnerId === match.homeId ? "home" : "away", state.teams) : null} nextMatch={nextMatch} syncReady={syncReady} />
        {match.paused ? <div className="mb-4 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-center font-display text-lg text-sky">Match paused</div> : null}

        <section className="grid grid-cols-2 gap-2 sm:gap-3">
          <ScorePanel side="home" name={homeName} players={playerLine(home, state.players)} score={game?.home ?? 0} games={wins.home} serving={match.serving === "home"} servingPlayer={match.serving === "home" ? servePlayer : ""} serviceCourt={match.serving === "home" ? serviceCourt : ""} positionNames={positionsNames(match, "home", state.players)} indicator={pointIndicator(match, "home")} animations={state.experienceSettings.animations} />
          <ScorePanel side="away" name={awayName} players={playerLine(away, state.players)} score={game?.away ?? 0} games={wins.away} serving={match.serving === "away"} servingPlayer={match.serving === "away" ? servePlayer : ""} serviceCourt={match.serving === "away" ? serviceCourt : ""} positionNames={positionsNames(match, "away", state.players)} indicator={pointIndicator(match, "away")} animations={state.experienceSettings.animations} />
        </section>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" /> {formatDuration(elapsed)}</span>
          <span>Game {Math.max(1, match.games.filter((item) => item.winner).length + (match.status === "completed" ? 0 : 1))} · Best of {match.bestOf}</span>
          <span>Game wins <strong className="text-foreground tabular-nums">{wins.home}–{wins.away}</strong></span>
          {match.serving ? <span className="font-semibold text-accent">Serve · {match.serving === "home" ? homeName : awayName}{servePlayer ? ` · ${servePlayer}` : ""} · {serviceCourt}</span> : null}
        </div>

        {match.status === "live" ? (
          <section className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
            <Button className="min-h-[5rem] justify-center rounded-2xl px-2 text-sm leading-tight sm:min-h-24 sm:px-4 sm:text-2xl" disabled={locked} onClick={() => award("home")}>
              +1 · {homeName}<span className="hidden text-sm opacity-70 sm:inline"> · key 1</span>
            </Button>
            <Button variant="sky" className="min-h-[5rem] justify-center rounded-2xl px-2 text-sm leading-tight sm:min-h-24 sm:px-4 sm:text-2xl" disabled={locked} onClick={() => award("away")}>
              +1 · {awayName}<span className="hidden text-sm opacity-70 sm:inline"> · key 2</span>
            </Button>
          </section>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-3">
          <Button variant="outline" size="lg" disabled={locked || !match.history.length || blockedUndo} onClick={undo} title={blockedUndo ? "The next match has started; this advancement can no longer be undone." : "Undo the latest scoring action"}><RotateCcw className="h-4 w-4" /> Undo</Button>
          {match.status === "live" ? <>
            {controller ? match.paused ? <Button size="lg" disabled={syncPending} onClick={() => dispatch({ type: "RESUME_MATCH", matchId })}><Play className="h-4 w-4" /> Resume</Button> : <Button variant="outline" size="lg" disabled={syncPending} onClick={() => dispatch({ type: "PAUSE_MATCH", matchId })}><Pause className="h-4 w-4" /> Pause</Button> : null}
          </> : null}
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-white/5"><History className="h-4 w-4" /> Match history</summary>
            <div className="absolute right-0 top-12 z-20 max-h-[55vh] w-[min(24rem,90vw)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl">
              {match.timeline.length ? <ol className="space-y-3">{[...match.timeline].reverse().map((event) => <li key={event.id} className="grid grid-cols-[5rem_1fr] gap-3 text-sm"><time className="text-xs text-muted">{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(event.at))}</time><span>{event.text}</span></li>)}</ol> : <p className="text-sm text-muted">No scoring events recorded.</p>}
            </div>
          </details>
        </div>

        <section className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl">Game scores</h2>
          <div className="mt-3 flex flex-wrap gap-2">{match.games.map((item, index) => <span key={`${match.id}-g${index}`} className={`rounded-xl px-3 py-2 text-sm tabular-nums ${item.winner ? "bg-white/10 text-foreground" : "bg-accent/10 text-accent"}`}>Game {index + 1} · {item.home}–{item.away}{item.winner ? ` · ${item.winner === "home" ? homeName : awayName}` : " · in play"}</span>)}</div>
        </section>
      </main>

      {celebration ? <Celebration kind={celebration.kind} name={celebration.name} confetti={state.experienceSettings.confetti} /> : null}
    </div>
  );
}

function ScorePanel({ side, name, players, score, games, serving, servingPlayer, serviceCourt, positionNames, indicator, animations }: { side: Side; name: string; players: string; score: number; games: number; serving: boolean; servingPlayer: string; serviceCourt: string; positionNames: string[]; indicator: string | null; animations: boolean }) {
  return (
    <article className={`relative overflow-hidden rounded-3xl border p-3 text-center sm:p-6 ${serving ? "border-accent/50 bg-accent/5" : "border-line bg-surface"}`}>
      <div className="flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:gap-2 sm:text-xs sm:tracking-[0.16em]"><span>{side === "home" ? "Side A" : "Side B"}</span><span>{games} {games === 1 ? "game" : "games"}</span></div>
      <h1 className="mt-2 font-display text-lg leading-tight tracking-tight sm:mt-3 sm:text-3xl">{name}</h1>
      {players ? <p className="mt-1 text-[11px] leading-snug text-muted sm:min-h-5 sm:text-sm">{players}</p> : <div className="min-h-5" />}
      <p className={`mt-2 font-display text-[4.5rem] leading-none tabular-nums sm:text-[8rem] ${serving ? "text-accent" : "text-foreground"}`} aria-label={`${name}: ${score}`}><AnimatedScore value={score} enabled={animations} /></p>
      {indicator ? <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-sky">{indicator}</p> : null}
      {serving ? <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-accent/15 px-2 py-1.5 text-[10px] font-semibold leading-tight text-accent sm:gap-2 sm:px-3 sm:text-xs"><Radio className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Serving{servingPlayer ? ` · ${servingPlayer}` : ""}{serviceCourt ? ` · ${serviceCourt}` : ""}</span></div> : <div className="mt-2 min-h-7" />}
      {positionNames.length === 2 ? <p className="mt-2 text-[10px] leading-tight text-muted sm:mt-3 sm:text-[11px]">Right: {positionNames[0]} · Left: {positionNames[1]}</p> : null}
    </article>
  );
}

function positionsNames(match: Match, side: Side, players: { id: string; name: string }[]) {
  const positions = match.positions?.[side];
  if (!positions) return [];
  return [positions.right, positions.left].map((id) => players.find((player) => player.id === id)?.name ?? "");
}

function pointIndicator(match: Match, side: Side) {
  const game = currentGame(match);
  if (!game || match.status !== "live" || game.winner) return null;
  const next = { home: game.home + Number(side === "home"), away: game.away + Number(side === "away") };
  if (!isGameComplete(next.home, next.away, { target: match.pointsPerGame, max: match.maxPoints, winBy: match.winBy })) return null;
  return gameWins(match)[side] + 1 >= gamesNeeded(match.bestOf) ? "Match point" : "Game point";
}

function Celebration({ kind, name, confetti }: { kind: "game" | "match"; name: string; confetti: boolean }) {
  return <div className="pointer-events-none fixed inset-x-4 top-24 z-[75] mx-auto max-w-lg overflow-hidden rounded-3xl border border-accent/40 bg-surface/95 px-6 py-5 text-center shadow-2xl backdrop-blur"><>{kind === "match" && confetti ? <ConfettiBurst /> : null}</><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{kind === "match" ? "Match won" : "Game won"}</p><p className="mt-1 font-display text-3xl">{name}</p></div>;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}
