"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function ShuttleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-6 w-6", className)} fill="none" aria-hidden>
      <path d="M32 4c1.2 7 2 13 2 18h-4c0-5 .8-11 2-18Z" fill="currentColor" />
      <path d="M20 16c4 7 8 12 12 16 4-4 8-9 12-16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 14c5 9 11 16 18 20M50 14c-5 9-11 16-18 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="50" r="7" fill="currentColor" />
      <path d="M27 50h10" stroke="#080D19" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FloatingShuttle({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("text-accent", className)}
      animate={reduce ? undefined : { y: [0, -16, 0], rotate: [-8, 8, -8] }}
      transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <ShuttleIcon className="h-16 w-16 sm:h-24 sm:w-24" />
    </motion.div>
  );
}
