"use client";

import { ArrowRight, Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ShuttleIcon } from "@/components/common/shuttle";
import { ROUND_LABEL } from "@/lib/constants";
import type { Match } from "@/types";

const sparks = [
  { left: "8%", top: "48%", color: "#c7ff3d", x: -12 },
  { left: "22%", top: "15%", color: "#38bdf8", x: -6 },
  { left: "42%", top: "78%", color: "#c7ff3d", x: 8 },
  { left: "61%", top: "10%", color: "#38bdf8", x: 12 },
  { left: "78%", top: "70%", color: "#c7ff3d", x: 6 },
  { left: "91%", top: "25%", color: "#38bdf8", x: -10 },
];

export function MatchResultBanner({
  match,
  winnerName,
  nextMatch,
  syncReady,
}: {
  match: Match;
  winnerName: string | null;
  nextMatch?: Match;
  syncReady: boolean;
}) {
  const reduce = useReducedMotion();
  const previous = useRef<{ matchId: string; status: Match["status"] } | null>(null);
  const readyBefore = useRef(syncReady);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const prior = previous.current;
    previous.current = { matchId: match.id, status: match.status };

    if (!syncReady) {
      readyBefore.current = false;
      return;
    }
    if (!readyBefore.current || !prior || prior.matchId !== match.id) {
      readyBefore.current = true;
      return;
    }

    if (prior.status === "live" && match.status === "completed" && match.winnerId) {
      setCelebrating(true);
      const timer = window.setTimeout(() => setCelebrating(false), 5_200);
      return () => window.clearTimeout(timer);
    }
  }, [match.id, match.status, match.winnerId, syncReady]);

  if (match.status !== "completed" || !match.winnerId || !winnerName) return null;

  const entryText = match.bestOf === 3
    ? nextMatch
      ? `Winner advances to ${ROUND_LABEL[nextMatch.round]}`
      : match.round === "final"
        ? "Best-of-three champion"
        : "Best-of-three winner recorded"
    : null;

  return (
    <motion.section
      key={`${match.id}:${match.winnerId}:${celebrating}`}
      initial={celebrating && !reduce ? { opacity: 0, y: 14, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 26 }}
      aria-live="polite"
      className="relative isolate mx-3 my-3 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/15 via-surface to-sky/10 px-4 py-4 sm:mx-5 sm:my-4 sm:px-6"
    >
      <div className="court-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />
      {celebrating && !reduce ? sparks.map((spark, index) => (
        <motion.span
          key={index}
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.3, y: 2, x: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 0.5], y: [2, -14, 12], x: spark.x }}
          transition={{ duration: 0.9, delay: index * 0.045, ease: "easeOut" }}
          className="pointer-events-none absolute h-2 w-2 rounded-sm"
          style={{ left: spark.left, top: spark.top, backgroundColor: spark.color }}
        />
      )) : null}

      <div className="relative flex items-center gap-3 sm:gap-4">
        <motion.span
          initial={celebrating && !reduce ? { rotate: -18, scale: 0.5 } : false}
          animate={{ rotate: 0, scale: 1 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 14, delay: celebrating ? 0.08 : 0 }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-[#101608] shadow-[0_0_26px_rgba(199,255,61,0.2)] sm:h-14 sm:w-14"
        >
          <Trophy className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent sm:text-xs">Match won</p>
          <p className="mt-0.5 truncate font-display text-xl leading-tight sm:text-2xl">{winnerName}</p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-line bg-background/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted sm:inline-flex">
          Best of {match.bestOf}
        </span>
      </div>

      {entryText ? (
        <motion.div
          key={`${match.id}:${match.winnerId}:entry`}
          initial={celebrating && !reduce ? { opacity: 0, x: -16 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.42, ease: "easeOut", delay: celebrating ? 0.42 : 0 }}
          className="relative mt-3 flex items-center gap-2 border-t border-line/80 pt-3 text-sm font-semibold text-sky sm:ml-[4.5rem] sm:mt-2 sm:border-0 sm:pt-0"
        >
          <motion.span
            initial={celebrating && !reduce ? { x: -7 } : false}
            animate={{ x: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, delay: celebrating ? 0.55 : 0 }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky/10 text-sky"
          >
            {nextMatch ? <ShuttleIcon className="h-4 w-4" /> : <Trophy className="h-3.5 w-3.5" />}
          </motion.span>
          <span className="min-w-0 truncate">{entryText}</span>
          {nextMatch ? <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-sky/70" aria-hidden="true" /> : null}
        </motion.div>
      ) : null}
    </motion.section>
  );
}
