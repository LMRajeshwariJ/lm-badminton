"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Radio, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/common/confetti-burst";
import { useTournament } from "@/context/tournament-context";
import { useLocalBoolean } from "@/hooks/use-local-boolean";
import { hasSupabaseConfig } from "@/lib/supabase";
import { playTournamentSound, type SoundEvent } from "@/lib/experience";
import { gameWins, sideName } from "@/lib/utils";
import type { Match } from "@/types";

const NOTIFICATION_KEY = "lm-tournament-notifications";

interface ToastItem {
  id: string;
  title: string;
  body: string;
  kind: "live" | "upcoming" | "finished" | "champion";
}

export function NotificationPreferenceButton() {
  const [enabled, setEnabled] = useLocalBoolean(NOTIFICATION_KEY, true);
  return <Button variant="ghost" size="icon" onClick={() => setEnabled(!enabled)} title={`Tournament notifications ${enabled ? "on" : "off"}`} aria-label={`Turn tournament notifications ${enabled ? "off" : "on"}`}>{enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted" />}</Button>;
}

export function TournamentNotifications() {
  const { state, syncConnected, syncReady } = useTournament();
  const [enabled] = useLocalBoolean(NOTIFICATION_KEY, true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const previous = useRef<Map<string, Match> | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!syncReady) return;
    const current = new Map(state.matches.map((match) => [match.id, structuredClone(match)]));
    if (!previous.current) {
      previous.current = current;
      return;
    }
    const additions: ToastItem[] = [];
    let sound: SoundEvent | null = null;
    if (state.role === "audience") {
      for (const match of state.matches) {
        const before = previous.current.get(match.id);
        if (!before) continue;
        if (before.status !== "completed" && match.status === "completed") sound = match.round === "final" ? "champion" : "match";
        else if (sound !== "champion" && sound !== "match" && finishedGameCount(match) > finishedGameCount(before)) sound = "game";
        else if (!sound && match.status === "live" && pointTotal(match) > pointTotal(before)) sound = "point";
      }
    }
    if (state.role === "audience" && enabled) {
      for (const match of state.matches) {
        const before = previous.current.get(match.id);
        if (!before) continue;
        const item = notificationFor(before, match, state);
        if (item && !seen.current.has(item.id)) {
          seen.current.add(item.id);
          additions.push(item);
        }
      }
    }
    previous.current = current;
    if (sound) playTournamentSound(sound, state.experienceSettings);
    if (additions.length) {
      const timer = window.setTimeout(() => setToasts((items) => [...items, ...additions].slice(-3)), 0);
      return () => window.clearTimeout(timer);
    }
  }, [enabled, state, syncReady]);

  return (
    <>
      {hasSupabaseConfig() && syncReady && !syncConnected ? <div className="fixed bottom-20 right-4 z-[65] rounded-full border border-sky/20 bg-background/95 px-3 py-2 text-xs text-sky shadow-xl lg:bottom-4">Live updates reconnecting…</div> : null}
      <div className="fixed inset-x-3 top-20 z-[70] ml-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-4" aria-live="polite">
        {toasts.map((toast) => <TournamentToast key={toast.id} toast={toast} dismiss={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} settings={state.experienceSettings} />)}
      </div>
    </>
  );
}

function pointTotal(match: Match) {
  return match.games.reduce((total, game) => total + game.home + game.away, 0);
}

function finishedGameCount(match: Match) {
  return match.games.filter((game) => game.winner).length;
}

function TournamentToast({ toast, dismiss, settings }: { toast: ToastItem; dismiss: () => void; settings: typeof import("@/lib/experience").DEFAULT_EXPERIENCE_SETTINGS }) {
  useEffect(() => {
    const timer = window.setTimeout(dismiss, toast.kind === "champion" ? 6000 : 5000);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.kind]);
  return (
    <article className={`toast-enter relative overflow-hidden rounded-2xl border bg-surface/95 p-4 pr-10 shadow-2xl backdrop-blur ${toast.kind === "champion" ? "border-accent/50" : "border-line"}`}>
      {toast.kind === "champion" && settings.animations && settings.confetti ? <ConfettiBurst strong /> : null}
      <button type="button" onClick={dismiss} aria-label="Dismiss notification" className="absolute right-2 top-2 rounded-full p-1 text-muted hover:bg-white/5 hover:text-foreground"><X className="h-4 w-4" /></button>
      <div className="relative flex gap-3">{toast.kind === "champion" || toast.kind === "finished" ? <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> : <Radio className="mt-0.5 h-5 w-5 shrink-0 text-sky" />}<div><p className="font-semibold">{toast.title}</p><p className="mt-1 text-sm text-muted">{toast.body}</p></div></div>
    </article>
  );
}

function notificationFor(before: Match, match: Match, state: ReturnType<typeof useTournament>["state"]): ToastItem | null {
  const home = sideName(match, "home", state.teams);
  const away = sideName(match, "away", state.teams);
  const court = state.courts.find((item) => item.id === match.courtId)?.name;
  if (before.status !== "live" && match.status === "live") {
    const final = match.round === "final";
    return { id: `${match.id}:started:${match.startedAt}`, title: final ? "🏆 The Final is LIVE!" : "🏸 Match Started!", body: `${home} vs ${away}${court ? ` — ${court}` : ""}`, kind: "live" };
  }
  if (before.status !== "completed" && match.status === "completed") {
    const winner = match.winnerId === match.homeId ? home : away;
    const opponent = match.winnerId === match.homeId ? away : home;
    if (match.round === "final") return { id: `${match.id}:champion:${match.completedAt}`, title: `🏆 Tournament Champion: ${winner}!`, body: `${winner} win the final against ${opponent}.`, kind: "champion" };
    const wins = gameWins(match);
    return { id: `${match.id}:finished:${match.completedAt}`, title: "🏆 Match Finished!", body: `${winner} win against ${opponent}, ${wins.home}–${wins.away} games.`, kind: "finished" };
  }
  const contendersReady = Boolean(match.homeId && match.awayId && (!before.homeId || !before.awayId));
  const courtAssigned = Boolean(match.courtId && match.courtId !== before.courtId);
  if (match.status === "upcoming" && (contendersReady || courtAssigned) && match.homeId && match.awayId) {
    return { id: `${match.id}:up-next:${match.homeId}:${match.awayId}:${match.courtId}`, title: "⏳ Up Next", body: `${home} vs ${away}${court ? ` — ${court}` : ""}`, kind: "upcoming" };
  }
  return null;
}
