import type { CategoryId, RoundId } from "@/types";

export const SCHEMA_VERSION = 3;
export const STORAGE_KEY = "lm-badminton-v3";

export const CATEGORY_META: Record<
  CategoryId,
  {
    label: string;
    shortLabel: string;
    pointsPerGame: number;
    maxPoints: number;
    bestOf: number;
    entryNoun: string;
    fieldSize: number;
    byeCount: number;
  }
> = {
  "mixed-doubles": {
    label: "Mixed Doubles",
    shortLabel: "Doubles",
    pointsPerGame: 15,
    maxPoints: 21,
    bestOf: 3,
    entryNoun: "teams",
    fieldSize: 18,
    byeCount: 14,
  },
  "womens-singles": {
    label: "Women's Singles",
    shortLabel: "Singles",
    pointsPerGame: 11,
    maxPoints: 15,
    bestOf: 3,
    entryNoun: "players",
    fieldSize: 9,
    byeCount: 3,
  },
};

export const CATEGORY_IDS: CategoryId[] = ["mixed-doubles", "womens-singles"];

export const ROUND_LABEL: Record<RoundId, string> = {
  preliminary: "Preliminary",
  "round-of-16": "Round of 16",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

export const ROUND_ORDER: RoundId[] = [
  "preliminary",
  "round-of-16",
  "quarterfinal",
  "semifinal",
  "final",
];

export function roundsFor(category: CategoryId): RoundId[] {
  if (category === "mixed-doubles") return [...ROUND_ORDER];
  return ["preliminary", "quarterfinal", "semifinal", "final"];
}

export function roundWeight(round: RoundId): number {
  return ROUND_ORDER.indexOf(round) + 1;
}
