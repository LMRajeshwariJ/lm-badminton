"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function AnimatedScore({ value, className, enabled = true }: { value: number; className?: string; enabled?: boolean }) {
  const reduce = useReducedMotion();
  const previous = useRef(value);
  const [burst, setBurst] = useState<number | null>(null);

  useEffect(() => {
    const delta = value - previous.current;
    previous.current = value;
    if (!enabled || delta <= 0 || delta > 3) {
      setBurst(null);
      return;
    }

    setBurst(delta);
    const timer = window.setTimeout(() => setBurst(null), 760);
    return () => window.clearTimeout(timer);
  }, [enabled, value]);

  return (
    <span className={`relative inline-flex justify-center ${className ?? ""}`}>
      <motion.span
        key={value}
        initial={reduce || !enabled ? false : { y: 12, scale: 0.72, opacity: 0.35 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={reduce || !enabled ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 22, mass: 0.65 }}
        className="relative z-10 tabular-nums"
      >
        {value}
      </motion.span>
      <AnimatePresence>
        {burst ? (
          <>
            {!reduce && enabled ? (
              <motion.span
                key={`ring-${value}`}
                aria-hidden="true"
                initial={{ opacity: 0.7, scale: 0.45 }}
                animate={{ opacity: 0, scale: 1.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent/70"
              />
            ) : null}
            <motion.span
              key={`point-${value}`}
              initial={reduce || !enabled ? false : { opacity: 0, y: 8, scale: 0.72, rotate: -8 }}
              animate={{ opacity: reduce || !enabled ? 1 : 0, y: reduce || !enabled ? 0 : -34, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: -38 }}
              transition={reduce || !enabled ? { duration: 0 } : { duration: 0.68, ease: "easeOut" }}
              className="pointer-events-none absolute -top-2 right-0 z-20 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-[#101608] shadow-[0_0_18px_rgba(199,255,61,0.35)]"
            >
              +{burst} point{burst === 1 ? "" : "s"}
            </motion.span>
          </>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
