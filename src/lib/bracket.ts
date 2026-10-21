import { CATEGORY_META, ROUND_LABEL, roundsFor } from "@/lib/constants";
import type {
  ByeAssignment,
  CategoryId,
  Match,
  MatchStatus,
  RoundId,
  Side,
  Team,
} from "@/types";

const MIXED_PAIR_ORDER = [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];
const SINGLES_PAIR_ORDER = [1, 8, 4, 5, 2, 7, 3, 6];

export interface DrawCheck {
  ok: boolean;
  issues: string[];
}

export interface GeneratedDraw {
  matches: Match[];
  byes: ByeAssignment[];
}

export function autoByeIds(teams: Team[], count: number) {
  return [...teams]
    .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name))
    .slice(0, count)
    .map((team) => team.id);
}

export function generateKnockout(
  category: CategoryId,
  teams: Team[],
  byeTeamIds?: string[],
): { ok: true; draw: GeneratedDraw } | { ok: false; reason: string } {
  const meta = CATEGORY_META[category];
  const field = teams.filter((team) => team.category === category);
  if (field.length !== meta.fieldSize) {
    return {
      ok: false,
      reason: `${meta.label} needs exactly ${meta.fieldSize} entries. This draw has ${field.length}.`,
    };
  }

  const requested = byeTeamIds ?? autoByeIds(field, meta.byeCount);
  const unique = new Set(requested);
  if (unique.size !== meta.byeCount || requested.length !== meta.byeCount) {
    return {
      ok: false,
      reason: `${meta.label} needs exactly ${meta.byeCount} distinct bye recipients.`,
    };
  }
  if (requested.some((id) => !field.some((team) => team.id === id))) {
    return { ok: false, reason: "Every bye must belong to a team in this category." };
  }

  const byeTeams = requested
    .map((id) => field.find((team) => team.id === id))
    .filter((team): team is Team => Boolean(team))
    .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));
  const playIn = field
    .filter((team) => !unique.has(team.id))
    .sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));

  if (category === "mixed-doubles") {
    if (meta.byeCount === 0) {
      if (playIn.length !== meta.fieldSize) {
        return { ok: false, reason: `Mixed doubles needs ${meta.fieldSize} teams in the round of 16.` };
      }
      return { ok: true, draw: buildMixedSixteenDraw(playIn) };
    }
    if (playIn.length !== 4) {
      return { ok: false, reason: "Mixed doubles play-in must contain the 4 teams without a bye." };
    }
    return { ok: true, draw: buildMixedDraw(byeTeams, playIn) };
  }

  if (playIn.length !== 2) {
    return { ok: false, reason: "Women's singles play-in must contain the 2 players without a bye." };
  }
  return { ok: true, draw: buildSinglesDraw(byeTeams, playIn) };
}

export function applyAdvancement(
  matches: Match[],
  matchId: string,
  winnerId: string,
): { matches: Match[]; advancement: ScoreAdvancement | null } {
  const source = matches.find((match) => match.id === matchId);
  if (!source?.nextMatchId || !source.nextSlot) {
    return { matches, advancement: null };
  }
  const next = matches.find((match) => match.id === source.nextMatchId);
  if (!next) return { matches, advancement: null };
  const previousId = source.nextSlot === "home" ? next.homeId : next.awayId;
  if (previousId && previousId !== winnerId) {
    return { matches, advancement: null };
  }
  const updated = matches.map((match) => {
    if (match.id !== next.id) return match;
    return source.nextSlot === "home"
      ? { ...match, homeId: winnerId }
      : { ...match, awayId: winnerId };
  });
  return {
    matches: updated,
    advancement: {
      matchId: next.id,
      slot: source.nextSlot,
      previousId,
    } satisfies ScoreAdvancement,
  };
}

export interface ScoreAdvancement {
  matchId: string;
  slot: Side;
  previousId: string | null;
}

export function reconcileSinglesProgression(matches: Match[], byes: ByeAssignment[]) {
  let nextMatches = matches;
  let nextByes = byes;
  const get = (id: string) => nextMatches.find((match) => match.id === id);
  const singlesByes = () => nextByes.filter((bye) => bye.category === "womens-singles");

  const opening = ["WS-M1", "WS-M2", "WS-M3", "WS-M4"].map(get);
  if (opening.every((match) => match?.status === "completed" && match.winnerId) && !nextByes.some((bye) => bye.id === "WS-BYE-ROUND2")) {
    const winners = opening.map((match) => match!.winnerId!);
    const eligible = winners.filter((id) => !singlesByes().some((bye) => bye.teamId === id));
    const byeRecipient = randomItem(eligible);
    if (byeRecipient) {
      const playing = winners.filter((id) => id !== byeRecipient);
      nextMatches = nextMatches.map((match) => {
        if (match.id === "WS-M5") return { ...match, homeId: playing[0], awayId: playing[1] };
        if (match.id === "WS-M6") return { ...match, homeId: playing[2], awayId: "WS09" };
        if (match.id === "WS-SF") return { ...match, homeId: byeRecipient };
        return match;
      });
      nextByes = [...nextByes, {
        id: "WS-BYE-ROUND2",
        category: "womens-singles",
        teamId: byeRecipient,
        skippedRound: "quarterfinal",
        intoMatchId: "WS-SF",
        slot: "home",
      }];
    }
  }

  const roundTwo = [getAfter(nextMatches, "WS-M5"), getAfter(nextMatches, "WS-M6")];
  if (roundTwo.every((match) => match?.status === "completed" && match.winnerId) && !nextByes.some((bye) => bye.id === "WS-BYE-FINAL")) {
    const winners = roundTwo.map((match) => match!.winnerId!);
    const eligible = winners.filter((id) => !nextByes.some((bye) => bye.category === "womens-singles" && bye.teamId === id));
    const byeRecipient = randomItem(eligible);
    if (byeRecipient) {
      const semifinalist = winners.find((id) => id !== byeRecipient)!;
      nextMatches = nextMatches.map((match) => {
        if (match.id === "WS-SF") return { ...match, awayId: semifinalist };
        if (match.id === "WS-F") return { ...match, homeId: byeRecipient };
        return match;
      });
      nextByes = [...nextByes, {
        id: "WS-BYE-FINAL",
        category: "womens-singles",
        teamId: byeRecipient,
        skippedRound: "semifinal",
        intoMatchId: "WS-F",
        slot: "home",
      }];
    }
  }

  return { matches: nextMatches, byes: nextByes };
}

function getAfter(matches: Match[], id: string) {
  return matches.find((match) => match.id === id);
}

function randomItem<T>(items: T[]) {
  if (!items.length) return undefined;
  const ceiling = Math.floor(0x100000000 / items.length) * items.length;
  let value = 0;
  do {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    value = bytes[0];
  } while (value >= ceiling);
  return items[value % items.length];
}

export function revertAdvancement(matches: Match[], advancement: ScoreAdvancement | null, winnerId: string | null) {
  if (!advancement) return matches;
  return matches.map((match) => {
    if (match.id !== advancement.matchId) return match;
    const current = advancement.slot === "home" ? match.homeId : match.awayId;
    if (current !== winnerId) return match;
    return advancement.slot === "home"
      ? { ...match, homeId: advancement.previousId }
      : { ...match, awayId: advancement.previousId };
  });
}

export function validateCategory(
  category: CategoryId,
  teams: Team[],
  matches: Match[],
  byes: ByeAssignment[],
): DrawCheck {
  const issues: string[] = [];
  const meta = CATEGORY_META[category];
  const field = teams.filter((team) => team.category === category);
  const draw = matches.filter((match) => match.category === category);
  const categoryByes = byes.filter((bye) => bye.category === category);

  if (field.length !== meta.fieldSize) {
    issues.push(`${meta.label} should have ${meta.fieldSize} entries, found ${field.length}.`);
  }
  const expectedByeCount = category === "womens-singles" ? expectedSinglesByes(draw) : meta.byeCount;
  if (categoryByes.length !== expectedByeCount) {
    issues.push(`${meta.label} should currently have ${expectedByeCount} bye assignments, found ${categoryByes.length}.`);
  }

  const expected = expectedCounts(category);
  for (const round of roundsFor(category)) {
    const count = draw.filter((match) => match.round === round).length;
    if (count !== expected[round]) {
      issues.push(`${ROUND_LABEL[round]} should have ${expected[round]} matches, found ${count}.`);
    }
  }
  if (category === "womens-singles" && draw.some((match) => match.round === "round-of-16")) {
    issues.push("Women's singles should not include a round of 16.");
  }

  for (const round of roundsFor(category)) {
    const seen = new Set<string>();
    for (const match of draw.filter((item) => item.round === round)) {
      for (const id of [match.homeId, match.awayId]) {
        if (!id) continue;
        if (seen.has(id)) issues.push(`${id} is in two ${ROUND_LABEL[round]} matches.`);
        seen.add(id);
      }
    }
  }

  const prelimIds = new Set(
    draw
      .filter((match) => match.round === "preliminary")
      .flatMap((match) => [match.homeId, match.awayId])
      .filter((id): id is string => Boolean(id)),
  );
  for (const bye of categoryByes) {
    if (prelimIds.has(bye.teamId)) {
      issues.push(`${bye.teamId} has both a bye and a preliminary match.`);
    }
    const destination = draw.find((match) => match.id === bye.intoMatchId);
    if (!destination) {
      issues.push(`Bye ${bye.id} points at a missing match.`);
      continue;
    }
    const placed = bye.slot === "home" ? destination.homeId : destination.awayId;
    if (placed !== bye.teamId) {
      issues.push(`Bye for ${bye.teamId} does not match ${destination.id}.`);
    }
  }

  for (const match of draw) {
    if (match.status === "completed") {
      if (!match.winnerId || (match.winnerId !== match.homeId && match.winnerId !== match.awayId)) {
        issues.push(`${match.id} is complete without a valid winner.`);
      }
    }
    if (!match.nextMatchId) continue;
    const next = draw.find((item) => item.id === match.nextMatchId);
    if (!next || !match.nextSlot) {
      issues.push(`${match.id} has a broken link into the next round.`);
      continue;
    }
    const slotId = match.nextSlot === "home" ? next.homeId : next.awayId;
    if (match.status === "completed") {
      if (slotId !== match.winnerId) {
        issues.push(`${match.id} winner did not advance into ${next.id}.`);
      }
    } else if (slotId) {
      issues.push(`${match.id} has not finished, but ${next.id} already has that slot filled.`);
    }
  }

  const liveCourts = new Map<string, string>();
  for (const match of draw) {
    if (match.status !== "live" || !match.courtId) continue;
    const existing = liveCourts.get(match.courtId);
    if (existing) issues.push(`Court ${match.courtId} is live for both ${existing} and ${match.id}.`);
    liveCourts.set(match.courtId, match.id);
  }

  return { ok: issues.length === 0, issues };
}

export interface StageProgress {
  id: string;
  label: string;
  detail: string;
  state: "complete" | "current" | "upcoming";
}

export function categoryProgress(category: CategoryId, matches: Match[], byes: ByeAssignment[]): StageProgress[] {
  const meta = CATEGORY_META[category];
  const draw = matches.filter((match) => match.category === category);
  const byeCount = byes.filter((bye) => bye.category === category).length;
  const stages: StageProgress[] = [
    {
      id: "field",
      label: `${meta.fieldSize} ${meta.entryNoun}`,
      detail: "Registered",
      state: "complete",
    },
  ];

  for (const round of roundsFor(category)) {
    const roundMatches = draw.filter((match) => match.round === round);
    const done = roundMatches.filter((match) => match.status === "completed").length;
    const live = roundMatches.filter((match) => match.status === "live").length;
    const waiting = roundMatches.length - done - live;
    const byeNote = round === "preliminary" ? ` · ${byeCount} byes` : "";
    const matchLabel = roundMatches.length === 1 ? "match" : "matches";
    stages.push({
      id: round,
      label: ROUND_LABEL[round],
      detail: `${roundMatches.length} ${matchLabel}${byeNote} · ${done} done · ${live} live · ${waiting} waiting`,
      state: roundState(roundMatches),
    });
  }

  const final = draw.find((match) => match.round === "final");
  stages.push({
    id: "champion",
    label: "Champion",
    detail: final?.status === "completed" ? "Title decided" : "One title left",
    state: final?.status === "completed" ? "complete" : "upcoming",
  });

  if (!stages.some((stage) => stage.state === "current")) {
    const next = stages.find((stage) => stage.state === "upcoming" && stage.id !== "champion");
    if (next) next.state = "current";
  }

  return stages;
}

export function mainRounds(category: CategoryId): RoundId[] {
  return roundsFor(category).filter((round) => round !== "preliminary");
}

function roundState(matches: Match[]): StageProgress["state"] {
  if (matches.length === 0) return "upcoming";
  if (matches.every((match) => match.status === "completed")) return "complete";
  if (matches.some((match) => match.status === "live" || match.status === "completed")) return "current";
  return "upcoming";
}

function expectedCounts(category: CategoryId): Record<RoundId, number> {
  if (category === "mixed-doubles") {
    return {
      preliminary: 0,
      "round-of-16": 8,
      quarterfinal: 4,
      semifinal: 2,
      final: 1,
    };
  }
  return {
    preliminary: 4,
    "round-of-16": 0,
    quarterfinal: 2,
    semifinal: 1,
    final: 1,
  };
}

function expectedSinglesByes(draw: Match[]) {
  const openingComplete = ["WS-M1", "WS-M2", "WS-M3", "WS-M4"].every((id) => draw.find((match) => match.id === id)?.status === "completed");
  const roundTwoComplete = ["WS-M5", "WS-M6"].every((id) => draw.find((match) => match.id === id)?.status === "completed");
  return roundTwoComplete ? 3 : openingComplete ? 2 : 1;
}

function buildMixedSixteenDraw(teams: Team[]): GeneratedDraw {
  const ordered = [...teams].sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));
  const r16 = ordered.reduce<Match[]>((matches, team, index) => {
    if (index % 2 === 1) return matches;
    const matchNumber = index / 2 + 1;
    const qfIndex = Math.ceil(matchNumber / 2);
    const slot: Side = matchNumber % 2 === 1 ? "home" : "away";
    matches.push(
      blankMatch({
        id: `MD-R16-${matchNumber}`,
        category: "mixed-doubles",
        round: "round-of-16",
        homeId: team.id,
        awayId: ordered[index + 1]?.id ?? null,
        nextMatchId: `MD-QF${qfIndex}`,
        nextSlot: slot,
      }),
    );
    return matches;
  }, []);
  const qf = [1, 2, 3, 4].map((index) =>
    blankMatch({
      id: `MD-QF${index}`,
      category: "mixed-doubles",
      round: "quarterfinal",
      homeId: null,
      awayId: null,
      homePlaceholder: `Winner R16-${index * 2 - 1}`,
      awayPlaceholder: `Winner R16-${index * 2}`,
      nextMatchId: index <= 2 ? "MD-SF1" : "MD-SF2",
      nextSlot: index % 2 === 1 ? "home" : "away",
    }),
  );
  const sf = [
    blankMatch({
      id: "MD-SF1",
      category: "mixed-doubles",
      round: "semifinal",
      homeId: null,
      awayId: null,
      homePlaceholder: "Winner QF1",
      awayPlaceholder: "Winner QF2",
      nextMatchId: "MD-F",
      nextSlot: "home",
    }),
    blankMatch({
      id: "MD-SF2",
      category: "mixed-doubles",
      round: "semifinal",
      homeId: null,
      awayId: null,
      homePlaceholder: "Winner QF3",
      awayPlaceholder: "Winner QF4",
      nextMatchId: "MD-F",
      nextSlot: "away",
    }),
  ];
  const final = [
    blankMatch({
      id: "MD-F",
      category: "mixed-doubles",
      round: "final",
      homeId: null,
      awayId: null,
      homePlaceholder: "Winner SF1",
      awayPlaceholder: "Winner SF2",
    }),
  ];
  return { matches: [...r16, ...qf, ...sf, ...final], byes: [] };
}

function buildMixedDraw(byeTeams: Team[], playIn: Team[]): GeneratedDraw {
  const slots = new Map<number, string | "W1" | "W2">();
  byeTeams.forEach((team, index) => slots.set(index + 1, team.id));
  slots.set(16, "W1");
  slots.set(15, "W2");

  const r16 = pairRound({
    category: "mixed-doubles",
    round: "round-of-16",
    order: MIXED_PAIR_ORDER,
    slots,
    idPrefix: "mixed-doubles-r16",
  });
  const qf = linkWinners(r16.matches, "mixed-doubles-qf", "quarterfinal");
  const sf = linkWinners(qf, "mixed-doubles-sf", "semifinal");
  const final = linkWinners(sf, "mixed-doubles-final", "final");

  const prelim = [
    blankMatch({
      id: "mixed-doubles-preliminary-1",
      category: "mixed-doubles",
      round: "preliminary",
      homeId: playIn[2].id,
      awayId: playIn[3].id,
      nextMatchId: r16.winnerSlots.W1.matchId,
      nextSlot: r16.winnerSlots.W1.slot,
    }),
    blankMatch({
      id: "mixed-doubles-preliminary-2",
      category: "mixed-doubles",
      round: "preliminary",
      homeId: playIn[0].id,
      awayId: playIn[1].id,
      nextMatchId: r16.winnerSlots.W2.matchId,
      nextSlot: r16.winnerSlots.W2.slot,
    }),
  ];

  const byes = byeTeams.map((team) => {
    const placed = findSlot(r16.matches, team.id);
    return {
      id: `bye-${team.id}`,
      category: "mixed-doubles" as const,
      teamId: team.id,
      skippedRound: "preliminary" as const,
      intoMatchId: placed.matchId,
      slot: placed.slot,
    };
  });

  return { matches: [...prelim, ...r16.matches, ...qf, ...sf, ...final], byes };
}

function buildSinglesDraw(byeTeams: Team[], playIn: Team[]): GeneratedDraw {
  const slots = new Map<number, string | "W">();
  byeTeams.forEach((team, index) => slots.set(index + 1, team.id));
  slots.set(8, "W");
  const quarter = pairRound({
    category: "womens-singles",
    round: "quarterfinal",
    order: SINGLES_PAIR_ORDER,
    slots,
    idPrefix: "womens-singles-qf",
  });
  const sf = linkWinners(quarter.matches, "womens-singles-sf", "semifinal");
  const final = linkWinners(sf, "womens-singles-final", "final");
  const prelim = blankMatch({
    id: "womens-singles-preliminary-1",
    category: "womens-singles",
    round: "preliminary",
    homeId: playIn[0].id,
    awayId: playIn[1].id,
    nextMatchId: quarter.winnerSlots.W.matchId,
    nextSlot: quarter.winnerSlots.W.slot,
  });
  const byes = byeTeams.map((team) => {
    const placed = findSlot(quarter.matches, team.id);
    return {
      id: `bye-${team.id}`,
      category: "womens-singles" as const,
      teamId: team.id,
      skippedRound: "preliminary" as const,
      intoMatchId: placed.matchId,
      slot: placed.slot,
    };
  });
  return { matches: [prelim, ...quarter.matches, ...sf, ...final], byes };
}

function pairRound<T extends string>(input: {
  category: CategoryId;
  round: RoundId;
  order: number[];
  slots: Map<number, string | T>;
  idPrefix: string;
}) {
  const matches: Match[] = [];
  const winnerSlots = {} as Record<string, { matchId: string; slot: Side }>;
  for (let index = 0; index < input.order.length; index += 2) {
    const matchNumber = index / 2 + 1;
    const id = `${input.idPrefix}-${matchNumber}`;
    const home = input.slots.get(input.order[index]);
    const away = input.slots.get(input.order[index + 1]);
    const match = blankMatch({
      id,
      category: input.category,
      round: input.round,
      homeId: teamIdFromSlot(home),
      awayId: teamIdFromSlot(away),
    });
    matches.push(match);
    const homeMarker = markerFromSlot(home);
    const awayMarker = markerFromSlot(away);
    if (homeMarker) winnerSlots[homeMarker] = { matchId: id, slot: "home" };
    if (awayMarker) winnerSlots[awayMarker] = { matchId: id, slot: "away" };
  }
  return { matches, winnerSlots };
}

function linkWinners(sources: Match[], idPrefix: string, round: RoundId) {
  const next: Match[] = [];
  for (let index = 0; index < sources.length; index += 2) {
    const matchNumber = index / 2 + 1;
    const id = round === "final" ? idPrefix : `${idPrefix}-${matchNumber}`;
    const match = blankMatch({
      id,
      category: sources[0].category,
      round,
      homeId: null,
      awayId: null,
    });
    sources[index] = { ...sources[index], nextMatchId: id, nextSlot: "home" };
    if (sources[index + 1]) {
      sources[index + 1] = { ...sources[index + 1], nextMatchId: id, nextSlot: "away" };
    }
    next.push(match);
  }
  return next;
}

function findSlot(matches: Match[], teamId: string) {
  for (const match of matches) {
    if (match.homeId === teamId) return { matchId: match.id, slot: "home" as const };
    if (match.awayId === teamId) return { matchId: match.id, slot: "away" as const };
  }
  throw new Error(`Team ${teamId} was not placed in the generated draw.`);
}

function blankMatch(input: {
  id: string;
  category: CategoryId;
  round: RoundId;
  homeId: string | null;
  awayId: string | null;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  nextMatchId?: string | null;
  nextSlot?: Side | null;
  status?: MatchStatus;
}): Match {
  const meta = CATEGORY_META[input.category];
  return {
    id: input.id,
    category: input.category,
    round: input.round,
    status: input.status ?? "upcoming",
    homeId: input.homeId,
    awayId: input.awayId,
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
    winnerId: null,
    nextMatchId: input.nextMatchId ?? null,
    nextSlot: input.nextSlot ?? null,
    paused: false,
    timeline: [],
    history: [],
  };
}

function teamIdFromSlot(value: string | undefined) {
  if (!value || value === "W" || value === "W1" || value === "W2") return null;
  return value;
}

function markerFromSlot(value: string | undefined) {
  if (value === "W" || value === "W1" || value === "W2") return value;
  return null;
}
