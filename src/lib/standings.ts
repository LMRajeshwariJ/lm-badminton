import { ROUND_LABEL, roundWeight } from "@/lib/constants";
import type { ByeAssignment, CategoryId, Match, RoundId, Team } from "@/types";

export interface StandingRow {
  team: Team;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  stage: string;
  alive: boolean;
  tier: number;
  result: "champion" | "finalist" | "semifinalist" | "active" | "eliminated";
}

export function buildStandings(
  category: CategoryId,
  teams: Team[],
  matches: Match[],
  byes: ByeAssignment[],
) {
  const rows = teams
    .filter((team) => team.category === category)
    .map((team) => standingFor(team, matches, byes));
  return rows.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.pointDiff !== b.pointDiff) return b.pointDiff - a.pointDiff;
    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;
    return a.team.seed - b.team.seed;
  });
}

export function spotlight(rows: StandingRow[]) {
  return {
    champions: rows.filter((row) => row.result === "champion"),
    finalists: rows.filter((row) => row.result === "finalist"),
    semifinalists: rows.filter((row) => row.result === "semifinalist"),
  };
}

function standingFor(team: Team, matches: Match[], byes: ByeAssignment[]): StandingRow {
  let played = 0;
  let won = 0;
  let lost = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let deepest = 0;
  let deepestRound: RoundId | null = null;
  let lostRound: RoundId | null = null;
  let wonFinal = false;

  for (const match of matches) {
    const side = match.homeId === team.id ? "home" : match.awayId === team.id ? "away" : null;
    if (!side) continue;
    const other = side === "home" ? "away" : "home";
    for (const game of match.games) {
      pointsFor += game[side];
      pointsAgainst += game[other];
      if (game.winner === side) gamesWon += 1;
      if (game.winner === other) gamesLost += 1;
    }
    const weight = roundWeight(match.round);
    if (weight > deepest) {
      deepest = weight;
      deepestRound = match.round;
    }
    if (match.status === "completed" && match.winnerId) {
      played += 1;
      if (match.winnerId === team.id) {
        won += 1;
        if (match.round === "final") wonFinal = true;
      } else {
        lost += 1;
        lostRound = match.round;
      }
    }
  }

  for (const bye of byes) {
    if (bye.teamId !== team.id) continue;
    const destination = matches.find((match) => match.id === bye.intoMatchId);
    if (!destination) continue;
    const weight = roundWeight(destination.round);
    if (weight > deepest) {
      deepest = weight;
      deepestRound = destination.round;
    }
  }

  const alive = !lostRound || wonFinal;
  let tier = 11;
  let stage = "Registered";
  let result: StandingRow["result"] = "active";

  if (wonFinal) {
    tier = 0;
    stage = "Champion";
    result = "champion";
  } else if (deepestRound === "final" && !lostRound) {
    tier = 1;
    stage = "Final";
    result = "finalist";
  } else if (lostRound === "final") {
    tier = 2;
    stage = "Finalist";
    result = "finalist";
  } else if (deepestRound === "semifinal" && !lostRound) {
    tier = 3;
    stage = "Semifinals";
    result = "semifinalist";
  } else if (lostRound === "semifinal") {
    tier = 4;
    stage = "Semifinalist";
    result = "semifinalist";
  } else if (deepestRound === "quarterfinal" && !lostRound) {
    tier = 5;
    stage = "Quarterfinals";
    result = "active";
  } else if (lostRound === "quarterfinal") {
    tier = 6;
    stage = "Out · Quarterfinals";
    result = "eliminated";
  } else if (deepestRound === "round-of-16" && !lostRound) {
    tier = 7;
    stage = "Round of 16";
    result = "active";
  } else if (lostRound === "round-of-16") {
    tier = 8;
    stage = "Out · Round of 16";
    result = "eliminated";
  } else if (deepestRound === "preliminary" && !lostRound) {
    tier = 9;
    stage = "Preliminary";
    result = "active";
  } else if (lostRound === "preliminary") {
    tier = 10;
    stage = "Out · Preliminary";
    result = "eliminated";
  } else if (deepestRound) {
    stage = ROUND_LABEL[deepestRound];
  }

  return {
    team,
    played,
    won,
    lost,
    gamesWon,
    gamesLost,
    pointsFor,
    pointsAgainst,
    pointDiff: pointsFor - pointsAgainst,
    stage,
    alive: wonFinal || (alive && !lostRound),
    tier,
    result,
  };
}
