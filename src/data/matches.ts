import { CATEGORY_META } from "@/lib/constants";
import type { ByeAssignment, CategoryId, Match, RoundId, Side } from "@/types";

function createMatch(input: {
  id: string;
  category: CategoryId;
  round: RoundId;
  homeId?: string | null;
  awayId?: string | null;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  nextMatchId?: string | null;
  nextSlot?: Side | null;
}): Match {
  const meta = CATEGORY_META[input.category];
  return {
    id: input.id,
    category: input.category,
    round: input.round,
    status: "upcoming",
    homeId: input.homeId ?? null,
    awayId: input.awayId ?? null,
    homePlaceholder: input.homePlaceholder,
    awayPlaceholder: input.awayPlaceholder,
    courtId: null,
    scheduledAt: null,
    pointsPerGame: meta.pointsPerGame,
    maxPoints: meta.maxPoints,
    bestOf: 3,
    winBy: 2,
    games: [],
    serving: null,
    servingPlayerId: null,
    positions: {},
    winnerId: null,
    startedAt: null,
    completedAt: null,
    nextMatchId: input.nextMatchId ?? null,
    nextSlot: input.nextSlot ?? null,
    paused: false,
    timeline: [],
    history: [],
  };
}

const md = (id: string, round: RoundId, homeId: string | null, awayId: string | null, nextMatchId?: string, nextSlot?: Side, homePlaceholder?: string, awayPlaceholder?: string) =>
  createMatch({ id, category: "mixed-doubles", round, homeId, awayId, nextMatchId, nextSlot, homePlaceholder, awayPlaceholder });

const ws = (id: string, round: RoundId, homeId: string | null, awayId: string | null, nextMatchId?: string, nextSlot?: Side, homePlaceholder?: string, awayPlaceholder?: string) =>
  createMatch({ id, category: "womens-singles", round, homeId, awayId, nextMatchId, nextSlot, homePlaceholder, awayPlaceholder });

export const matches: Match[] = [
  md("MD-R16-1", "round-of-16", "T01", "T02", "MD-QF1", "home"),
  md("MD-R16-2", "round-of-16", "T03", "T04", "MD-QF1", "away"),
  md("MD-R16-3", "round-of-16", "T05", "T06", "MD-QF2", "home"),
  md("MD-R16-4", "round-of-16", "T07", "T08", "MD-QF2", "away"),
  md("MD-R16-5", "round-of-16", "T09", "T10", "MD-QF3", "home"),
  md("MD-R16-6", "round-of-16", "T11", "T12", "MD-QF3", "away"),
  md("MD-R16-7", "round-of-16", "T13", "T14", "MD-QF4", "home"),
  md("MD-R16-8", "round-of-16", "T15", "T16", "MD-QF4", "away"),
  md("MD-QF1", "quarterfinal", null, null, "MD-SF1", "home", "Winner R16-1", "Winner R16-2"),
  md("MD-QF2", "quarterfinal", null, null, "MD-SF1", "away", "Winner R16-3", "Winner R16-4"),
  md("MD-QF3", "quarterfinal", null, null, "MD-SF2", "home", "Winner R16-5", "Winner R16-6"),
  md("MD-QF4", "quarterfinal", null, null, "MD-SF2", "away", "Winner R16-7", "Winner R16-8"),
  md("MD-SF1", "semifinal", null, null, "MD-F", "home", "Winner QF1", "Winner QF2"),
  md("MD-SF2", "semifinal", null, null, "MD-F", "away", "Winner QF3", "Winner QF4"),
  md("MD-F", "final", null, null, undefined, undefined, "Winner SF1", "Winner SF2"),

  ws("WS-M1", "preliminary", "WS01", "WS02"),
  ws("WS-M2", "preliminary", "WS03", "WS04"),
  ws("WS-M3", "preliminary", "WS05", "WS06"),
  ws("WS-M4", "preliminary", "WS07", "WS08"),
  ws("WS-M5", "quarterfinal", null, null, undefined, undefined, "Decided after M1–M4", "Decided after M1–M4"),
  ws("WS-M6", "quarterfinal", null, "WS09", undefined, undefined, "Decided after M1–M4"),
  ws("WS-SF", "semifinal", null, null, "WS-F", "away", "Round 2 bye", "Winner M5/M6"),
  ws("WS-F", "final", null, null, undefined, undefined, "Semifinal bye", "Winner SF"),
];

function bye(id: string, category: CategoryId, teamId: string, skippedRound: RoundId, intoMatchId: string, slot: Side): ByeAssignment {
  return { id, category, teamId, skippedRound, intoMatchId, slot };
}

export const byes: ByeAssignment[] = [
  bye("WS-BYE-INITIAL", "womens-singles", "WS09", "preliminary", "WS-M6", "away"),
];
