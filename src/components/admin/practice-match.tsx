"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { AnimatedScore } from "@/components/common/animated-score";
import { useTournament } from "@/context/tournament-context";
import { CATEGORY_META } from "@/lib/constants";
import { gameWinner, gamesNeeded } from "@/lib/scoring";
import { readAdminSession } from "@/lib/supabase";
import type { CategoryId, GameScore, Side } from "@/types";

interface PracticeSnapshot {
  games: GameScore[];
  serving: Side;
  complete: boolean;
}

export function PracticeMatch() {
  const { state } = useTournament();
  const reduce = useReducedMotion();
  const [category, setCategory] = useState<CategoryId>("mixed-doubles");
  const [teamIds, setTeamIds] = useState<[string, string]>(() => randomPair(state.teams.filter((team) => team.category === "mixed-doubles").map((team) => team.id)));
  const [pointsPerGame, setPointsPerGame] = useState(15);
  const [maxPoints, setMaxPoints] = useState(21);
  const [bestOf, setBestOf] = useState(3);
  const [games, setGames] = useState<GameScore[]>([{ home: 0, away: 0, winner: null }]);
  const [serving, setServing] = useState<Side>("home");
  const [complete, setComplete] = useState(false);
  const [history, setHistory] = useState<PracticeSnapshot[]>([]);
  const teams = useMemo(() => teamIds.map((id) => state.teams.find((team) => team.id === id)), [state.teams, teamIds]);
  const wins = games.reduce((total, game) => ({ home: total.home + Number(game.winner === "home"), away: total.away + Number(game.winner === "away") }), { home: 0, away: 0 });
  const current = games.at(-1)!;
  const valid = pointsPerGame >= 1 && maxPoints >= pointsPerGame && [1, 3, 5].includes(bestOf);

  if (state.role !== "admin" || !readAdminSession()) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><h1 className="font-display text-4xl">Admin access required</h1><p className="mt-3 text-muted">Enter the admin password before opening practice scoring.</p></div>;
  }

  function chooseCategory(next: CategoryId) {
    setCategory(next);
    const meta = CATEGORY_META[next];
    setPointsPerGame(meta.pointsPerGame);
    setMaxPoints(meta.maxPoints);
    setBestOf(meta.bestOf);
    setTeamIds(randomPair(state.teams.filter((team) => team.category === next).map((team) => team.id)));
    resetScore();
  }

  function randomize() {
    setTeamIds(randomPair(state.teams.filter((team) => team.category === category).map((team) => team.id)));
    resetScore();
  }

  function resetScore() {
    setGames([{ home: 0, away: 0, winner: null }]);
    setServing("home");
    setComplete(false);
    setHistory([]);
  }

  function award(side: Side) {
    if (complete || !valid) return;
    setHistory((items) => [...items, { games: structuredClone(games), serving, complete }]);
    const nextGames = structuredClone(games);
    const game = nextGames.at(-1)!;
    game[side] += 1;
    game.winner = gameWinner(game.home, game.away, { target: pointsPerGame, max: maxPoints, winBy: 2 });
    setServing(side);
    if (game.winner) {
      const nextWins = { home: wins.home + Number(game.winner === "home"), away: wins.away + Number(game.winner === "away") };
      if (nextWins[game.winner] >= gamesNeeded(bestOf)) setComplete(true);
      else nextGames.push({ home: 0, away: 0, winner: null });
    }
    setGames(nextGames);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setGames(previous.games);
    setServing(previous.serving);
    setComplete(previous.complete);
    setHistory((items) => items.slice(0, -1));
  }

  const homeName = teams[0]?.name ?? "Side A";
  const awayName = teams[1]?.name ?? "Side B";
  const winnerName = wins.home >= gamesNeeded(bestOf) ? homeName : wins.away >= gamesNeeded(bestOf) ? awayName : "";
  const input = "mt-1 w-full rounded-xl border border-line bg-background px-3 py-2";
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Admin</Link>
      <header className="mt-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Private test area</p><h1 className="mt-2 font-display text-4xl sm:text-6xl">Practice scoring</h1><p className="mt-2 text-muted">This match stays in this browser and never changes the tournament draw, results, or database.</p></header>
      <section className="mt-6 grid gap-3 rounded-3xl border border-line bg-surface p-5 sm:grid-cols-5">
        <label className="text-sm font-semibold sm:col-span-2">Category<select className={input} value={category} onChange={(event) => chooseCategory(event.target.value as CategoryId)}><option value="mixed-doubles">Mixed Doubles</option><option value="womens-singles">Women&apos;s Singles</option></select></label>
        <label className="text-sm font-semibold">Points per game<input className={input} type="number" min={1} max={99} value={pointsPerGame} onChange={(event) => { setPointsPerGame(Number(event.target.value)); resetScore(); }} /></label>
        <label className="text-sm font-semibold">Point cap<input className={input} type="number" min={1} max={99} value={maxPoints} onChange={(event) => { setMaxPoints(Number(event.target.value)); resetScore(); }} /></label>
        <label className="text-sm font-semibold">Games<select className={input} value={bestOf} onChange={(event) => { setBestOf(Number(event.target.value)); resetScore(); }}><option value={1}>Best of 1</option><option value={3}>Best of 3</option><option value={5}>Best of 5</option></select></label>
        <div className="sm:col-span-5"><Button variant="outline" onClick={randomize}>New random match</Button>{!valid ? <span className="ml-3 text-sm text-danger">Cap must be at least the points target.</span> : null}</div>
      </section>
      {complete ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24 }}
          aria-live="polite"
          className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/15 via-surface to-sky/10 px-4 py-4 text-center"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-[#101608]"><Trophy className="h-5 w-5" aria-hidden="true" /></span>
          <span className="min-w-0"><span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent">Practice winner</span><span className="block truncate font-display text-xl sm:text-2xl">{winnerName}</span></span>
          {bestOf === 3 ? <motion.span initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={reduce ? { duration: 0 } : { delay: 0.35, duration: 0.35 }} className="hidden rounded-full bg-sky/10 px-3 py-1 text-xs font-bold text-sky sm:inline-flex">Best of 3 clinched</motion.span> : null}
        </motion.div>
      ) : null}
      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <PracticeSide name={homeName} score={current.home} games={wins.home} serving={serving === "home"} />
        <PracticeSide name={awayName} score={current.away} games={wins.away} serving={serving === "away"} />
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2"><Button className="min-h-24 rounded-2xl text-2xl" disabled={complete || !valid} onClick={() => award("home")}>+1 · {homeName}</Button><Button variant="sky" className="min-h-24 rounded-2xl text-2xl" disabled={complete || !valid} onClick={() => award("away")}>+1 · {awayName}</Button></section>
      <div className="mt-4 flex flex-wrap justify-center gap-2 rounded-2xl border border-line bg-surface p-3"><Button variant="outline" size="lg" disabled={!history.length} onClick={undo}><RotateCcw className="h-4 w-4" /> Undo</Button><Button variant="outline" size="lg" disabled={complete || !valid} onClick={() => award(serving === "home" ? "away" : "home")}>Fault serve</Button><Button variant="ghost" size="lg" onClick={resetScore}>Reset practice match</Button></div>
      <section className="mt-4 rounded-2xl border border-line bg-surface p-4"><h2 className="font-display text-xl">Game scores</h2><div className="mt-3 flex flex-wrap gap-2">{games.map((game, index) => <span key={index} className="rounded-xl bg-white/10 px-3 py-2 text-sm">Game {index + 1} · {game.home}–{game.away}{game.winner ? ` · ${game.winner === "home" ? homeName : awayName}` : " · in play"}</span>)}</div></section>
    </div>
  );
}

function PracticeSide({ name, score, games, serving }: { name: string; score: number; games: number; serving: boolean }) {
  return <article className={`rounded-3xl border p-5 text-center ${serving ? "border-accent/50 bg-accent/5" : "border-line bg-surface"}`}><div className="flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-muted"><span>{serving ? "Serving" : "Receiving"}</span><span>{games} {games === 1 ? "game" : "games"}</span></div><h2 className="mt-3 font-display text-3xl">{name}</h2><AnimatedScore value={score} className={`font-display text-[8rem] leading-none ${serving ? "text-accent" : "text-foreground"}`} /></article>;
}

function randomPair(ids: string[]): [string, string] {
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  return [shuffled[0] ?? "", shuffled[1] ?? ""];
}
