"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const previous = useRef(value);
  const [burst, setBurst] = useState<number | null>(null);

  useEffect(() => {
    const delta = value - previous.current;
    if (delta > 0 && delta <= 3 && previous.current !== value) {
      setBurst(delta);
      const timer = window.setTimeout(() => setBurst(null), 700);
      previous.current = value;
      return () => window.clearTimeout(timer);
    }
    previous.current = value;
  }, [value]);

  return (
    <span className={`relative inline-flex justify-center ${className ?? ""}`}>
      <motion.span
        key={value}
        initial={reduce ? false : { y: 10, opacity: 0.35 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22 }}
        className="tabular-nums"
      >
        {value}
      </motion.span>
      {burst ? (
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: -12 }}
          exit={{ opacity: 0 }}
          className="absolute -top-1 right-0 text-sm font-bold text-accent"
        >
          +{burst}
        </motion.span>
      ) : null}
    </span>
  );
}
