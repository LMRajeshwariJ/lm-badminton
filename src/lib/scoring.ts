export interface ScoringConfig {
  target: number;
  max: number;
  winBy: number;
  bestOf: number;
}

export const POINT_PRESETS = [
  { target: 11, max: 15, label: "11 points" },
  { target: 15, max: 21, label: "15 points" },
  { target: 21, max: 30, label: "21 points" },
] as const;

export function defaultMaxForTarget(target: number) {
  if (target === 11) return 15;
  if (target === 15) return 21;
  if (target === 21) return 30;
  return target + 6;
}

export function validateScoringSetup(target: number, max: number) {
  if (!Number.isInteger(target) || target < 5 || target > 50) {
    return "Points per game must be a whole number from 5 to 50.";
  }
  if (!Number.isInteger(max) || max <= target || max > 60) {
    return "The score cap must be a whole number above the target, up to 60.";
  }
  return null;
}

export function isGameComplete(home: number, away: number, config: Pick<ScoringConfig, "target" | "max" | "winBy">) {
  const high = Math.max(home, away);
  const low = Math.min(home, away);
  if (high === low) return false;
  if (high >= config.max) return true;
  return high >= config.target && high - low >= config.winBy;
}

export function gameWinner(home: number, away: number, config: Pick<ScoringConfig, "target" | "max" | "winBy">) {
  if (!isGameComplete(home, away, config)) return null;
  return home > away ? "home" : "away";
}

export function gamesNeeded(bestOf: number) {
  return Math.ceil(bestOf / 2);
}

export function matchWinnerSide(wins: { home: number; away: number }, bestOf: number) {
  const needed = gamesNeeded(bestOf);
  if (wins.home >= needed) return "home" as const;
  if (wins.away >= needed) return "away" as const;
  return null;
}
