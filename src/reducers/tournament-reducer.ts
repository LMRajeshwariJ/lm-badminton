import { createInitialState } from "@/data/initial-state";
import { applyAdvancement, generateKnockout, reconcileSinglesProgression, revertAdvancement } from "@/lib/bracket";
import { CATEGORY_META, SCHEMA_VERSION } from "@/lib/constants";
import { defaultMaxForTarget, gameWinner, gamesNeeded, isGameComplete, validateScoringSetup } from "@/lib/scoring";
import type {
  AppState,
  ByeAssignment,
  CategoryId,
  Court,
  Match,
  Player,
  Role,
  ScoreHistoryEntry,
  Side,
  Team,
  TimelineEvent,
} from "@/types";

export type Action =
  | { type: "HYDRATE"; state: AppState }
  | { type: "SYNC_MATCHES"; matches: Match[] }
  | { type: "SET_ROLE"; role: Role }
  | { type: "RESET" }
  | { type: "RESET_MATCH"; matchId: string }
  | { type: "RESET_CATEGORY"; category: CategoryId }
  | { type: "ADD_TEAM"; team: Team; players: Player[] }
  | { type: "UPDATE_TEAM"; team: Team; players?: Player[] }
  | { type: "DELETE_TEAM"; teamId: string }
  | { type: "CREATE_FIXTURE"; match: Match }
  | { type: "UPDATE_FIXTURE"; matchId: string; patch: Partial<Pick<Match, "homeId" | "awayId" | "round" | "scheduledAt" | "courtId" | "category" | "pointsPerGame" | "maxPoints" | "bestOf">> }
  | { type: "UPDATE_SCORING_RULES"; category?: CategoryId; pointsPerGame: number; maxPoints: number; bestOf: number }
  | { type: "DELETE_FIXTURE"; matchId: string }
  | { type: "ASSIGN_BYE"; bye: ByeAssignment }
  | { type: "GENERATE_BRACKET"; category: CategoryId; byeTeamIds?: string[] }
  | { type: "ASSIGN_COURT"; matchId: string; courtId: string }
  | { type: "START_MATCH"; matchId: string; courtId: string; pointsPerGame: number; maxPoints?: number; servingSide?: Side; servingPlayerId?: string; receivingPlayerId?: string }
  | { type: "SCORE_POINT"; matchId: string; side: Side; action?: "rally" | "service-fault" | "fault"; faultBy?: Side; faultReason?: string }
  | { type: "UNDO_POINT"; matchId: string }
  | { type: "PAUSE_MATCH"; matchId: string }
  | { type: "RESUME_MATCH"; matchId: string }
  | { type: "COMPLETE_GAME"; matchId: string }
  | { type: "COMPLETE_MATCH"; matchId: string }
  | { type: "ADD_COURT"; court: Court }
  | { type: "UPDATE_COURT"; court: Court }
  | { type: "DELETE_COURT"; courtId: string }
  | { type: "UPDATE_TOURNAMENT"; patch: Partial<AppState["tournament"]> };

export function tournamentReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      return action.state.schemaVersion === SCHEMA_VERSION ? structuredClone(action.state) : state;
    case "SYNC_MATCHES": {
      const incoming = new Map(action.matches.map((match) => [match.id, match]));
      return { ...state, matches: state.matches.map((match) => incoming.get(match.id) ?? match) };
    }
    case "SET_ROLE":
      return { ...state, role: action.role };
    case "RESET":
      return { ...createInitialState(), role: state.role };
    case "RESET_MATCH":
      return resetMatch(state, action.matchId);
    case "RESET_CATEGORY":
      return resetCategory(state, action.category);
    case "ADD_TEAM":
      return addTeam(state, action.team, action.players);
    case "UPDATE_TEAM":
      return updateTeam(state, action.team, action.players);
    case "DELETE_TEAM":
      return deleteTeam(state, action.teamId);
    case "CREATE_FIXTURE":
      return createFixture(state, action.match);
    case "UPDATE_FIXTURE":
      return updateFixture(state, action.matchId, action.patch);
    case "UPDATE_SCORING_RULES":
      return updateScoringRules(state, action);
    case "DELETE_FIXTURE":
      return deleteFixture(state, action.matchId);
    case "ASSIGN_BYE":
      return assignBye(state, action.bye);
    case "GENERATE_BRACKET":
      return generateBracket(state, action.category, action.byeTeamIds);
    case "ASSIGN_COURT":
      return assignCourt(state, action.matchId, action.courtId);
    case "START_MATCH":
      return startMatch(state, action);
    case "SCORE_POINT":
      return scorePoint(state, action.matchId, action.side, action);
    case "UNDO_POINT":
      return undoPoint(state, action.matchId);
    case "PAUSE_MATCH":
      return pauseMatch(state, action.matchId, true);
    case "RESUME_MATCH":
      return pauseMatch(state, action.matchId, false);
    case "COMPLETE_GAME":
      return completeGame(state, action.matchId);
    case "COMPLETE_MATCH":
      return completeMatch(state, action.matchId);
    case "ADD_COURT":
      if (state.courts.some((court) => court.id === action.court.id)) return state;
      return { ...state, courts: [...state.courts, action.court] };
    case "UPDATE_COURT":
      return {
        ...state,
        courts: state.courts.map((court) => (court.id === action.court.id ? action.court : court)),
      };
    case "DELETE_COURT":
      return deleteCourt(state, action.courtId);
    case "UPDATE_TOURNAMENT":
      return { ...state, tournament: { ...state.tournament, ...action.patch, id: state.tournament.id } };
    default:
      return state;
  }
}

function addTeam(state: AppState, team: Team, players: Player[]) {
  if (state.teams.some((item) => item.id === team.id)) return state;
  const expected = team.category === "mixed-doubles" ? 2 : 1;
  if (team.playerIds.length !== expected) return state;
  return {
    ...state,
    teams: [...state.teams, team],
    players: mergePlayers(state.players, players),
  };
}

function resetCategory(state: AppState, category: CategoryId) {
  const initial = createInitialState();
  return {
    ...state,
    matches: [...state.matches.filter((match) => match.category !== category), ...initial.matches.filter((match) => match.category === category)],
    byes: [...state.byes.filter((bye) => bye.category !== category), ...initial.byes.filter((bye) => bye.category === category)],
  };
}

function resetMatch(state: AppState, matchId: string) {
  const target = state.matches.find((match) => match.id === matchId);
  if (!target) return state;
  if (target.category === "womens-singles") return resetCategory(state, "womens-singles");
  const initial = createInitialState();
  const resetIds = new Set<string>();
  let cursor: Match | undefined = target;
  while (cursor) {
    resetIds.add(cursor.id);
    cursor = cursor.nextMatchId ? state.matches.find((match) => match.id === cursor?.nextMatchId) : undefined;
  }
  return {
    ...state,
    matches: state.matches.map((match) => {
      if (!resetIds.has(match.id)) return match;
      const baseline = initial.matches.find((item) => item.id === match.id);
      return baseline ? structuredClone(baseline) : match;
    }),
  };
}

function updateTeam(state: AppState, team: Team, players?: Player[]) {
  if (!state.teams.some((item) => item.id === team.id)) return state;
  return {
    ...state,
    teams: state.teams.map((item) => (item.id === team.id ? team : item)),
    players: players ? mergePlayers(state.players, players) : state.players,
  };
}

function deleteTeam(state: AppState, teamId: string) {
  const blocked = state.matches.some(
    (match) =>
      (match.homeId === teamId || match.awayId === teamId) &&
      (match.status === "live" || match.status === "completed"),
  );
  if (blocked) return state;
  return {
    ...state,
    teams: state.teams.filter((team) => team.id !== teamId),
    byes: state.byes.filter((bye) => bye.teamId !== teamId),
    matches: state.matches.map((match) => {
      if (match.status !== "upcoming") return match;
      return {
        ...match,
        homeId: match.homeId === teamId ? null : match.homeId,
        awayId: match.awayId === teamId ? null : match.awayId,
      };
    }),
  };
}

function createFixture(state: AppState, match: Match) {
  if (state.matches.some((item) => item.id === match.id)) return state;
  if (match.status !== "upcoming") return state;
  if (!sameCategory(state, match.homeId, match.category) || !sameCategory(state, match.awayId, match.category)) {
    return state;
  }
  if (match.homeId && match.homeId === match.awayId) return state;
  if (occupiesRound(state.matches, match)) return state;
  return { ...state, matches: [...state.matches, { ...match, games: [], winnerId: null, history: [], timeline: [] }] };
}

function updateFixture(
  state: AppState,
  matchId: string,
  patch: Partial<Pick<Match, "homeId" | "awayId" | "round" | "scheduledAt" | "courtId" | "category" | "pointsPerGame" | "maxPoints" | "bestOf">>,
) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "upcoming") return state;
  const next = { ...match, ...patch };
  if (!validScoringRules(next.pointsPerGame, next.maxPoints, next.bestOf)) return state;
  if (next.homeId && next.homeId === next.awayId) return state;
  if (!sameCategory(state, next.homeId, next.category) || !sameCategory(state, next.awayId, next.category)) {
    return state;
  }
  if (occupiesRound(state.matches, next, match.id)) return state;
  return { ...state, matches: state.matches.map((item) => (item.id === match.id ? next : item)) };
}

function updateScoringRules(
  state: AppState,
  action: Extract<Action, { type: "UPDATE_SCORING_RULES" }>,
) {
  if (!validScoringRules(action.pointsPerGame, action.maxPoints, action.bestOf)) return state;
  return {
    ...state,
    matches: state.matches.map((match) => {
      if (match.status !== "upcoming" || (action.category && match.category !== action.category)) return match;
      return { ...match, pointsPerGame: action.pointsPerGame, maxPoints: action.maxPoints, bestOf: action.bestOf };
    }),
  };
}

function validScoringRules(pointsPerGame: number, maxPoints: number, bestOf: number) {
  return (
    Number.isInteger(pointsPerGame) && pointsPerGame >= 1 && pointsPerGame <= 99 &&
    Number.isInteger(maxPoints) && maxPoints >= pointsPerGame && maxPoints <= 99 &&
    Number.isInteger(bestOf) && [1, 3, 5].includes(bestOf)
  );
}

function deleteFixture(state: AppState, matchId: string) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "upcoming") return state;
  if (match.games.some((game) => game.home > 0 || game.away > 0)) return state;
  return {
    ...state,
    matches: state.matches
      .filter((item) => item.id !== matchId)
      .map((item) => (item.nextMatchId === matchId ? { ...item, nextMatchId: null, nextSlot: null } : item)),
    byes: state.byes.filter((bye) => bye.intoMatchId !== matchId),
  };
}

function assignBye(state: AppState, bye: ByeAssignment) {
  const destination = state.matches.find((match) => match.id === bye.intoMatchId);
  const team = state.teams.find((item) => item.id === bye.teamId);
  if (!destination || !team || destination.status !== "upcoming") return state;
  if (team.category !== bye.category || destination.category !== bye.category) return state;
  const current = bye.slot === "home" ? destination.homeId : destination.awayId;
  if (current && current !== bye.teamId) return state;
  if (occupiesRound(state.matches, { ...destination, [bye.slot === "home" ? "homeId" : "awayId"]: bye.teamId }, destination.id)) {
    return state;
  }

  let matches = state.matches.map((match) => {
    if (match.id === destination.id) {
      return bye.slot === "home" ? { ...match, homeId: bye.teamId } : { ...match, awayId: bye.teamId };
    }
    if (match.status !== "upcoming" || match.round !== bye.skippedRound || match.category !== bye.category) {
      return match;
    }
    if (match.homeId !== bye.teamId && match.awayId !== bye.teamId) return match;
    return {
      ...match,
      homeId: match.homeId === bye.teamId ? null : match.homeId,
      awayId: match.awayId === bye.teamId ? null : match.awayId,
    };
  });
  matches = matches.filter((match) => match.status !== "upcoming" || match.homeId || match.awayId || match.round !== "preliminary");

  const byes = [
    ...state.byes.filter((item) => item.teamId !== bye.teamId || item.category !== bye.category),
    bye,
  ];
  return { ...state, matches, byes };
}

function generateBracket(state: AppState, category: CategoryId, byeTeamIds?: string[]) {
  const existing = state.matches.filter((match) => match.category === category);
  const locked = existing.some((match) => match.status !== "upcoming" || match.games.length > 0);
  if (locked) return state;
  const generated = generateKnockout(category, state.teams, byeTeamIds);
  if (!generated.ok) return state;
  return {
    ...state,
    matches: [...state.matches.filter((match) => match.category !== category), ...generated.draw.matches],
    byes: [...state.byes.filter((bye) => bye.category !== category), ...generated.draw.byes],
  };
}

function assignCourt(state: AppState, matchId: string, courtId: string) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.status === "completed") return state;
  if (!state.courts.some((court) => court.id === courtId)) return state;
  if (courtBusy(state.matches, courtId, match.id)) return state;
  return replaceMatch(state, { ...match, courtId });
}

function startMatch(state: AppState, action: Extract<Action, { type: "START_MATCH" }>) {
  const match = state.matches.find((item) => item.id === action.matchId);
  if (!match || match.status !== "upcoming" || !match.homeId || !match.awayId) return state;
  if (!state.courts.some((court) => court.id === action.courtId)) return state;
  if (courtBusy(state.matches, action.courtId, match.id)) return state;
  const playing = state.matches.some(
    (item) =>
      item.status === "live" &&
      (item.homeId === match.homeId || item.awayId === match.homeId || item.homeId === match.awayId || item.awayId === match.awayId),
  );
  if (playing) return state;
  const maxPoints = action.maxPoints ?? defaultMaxForTarget(action.pointsPerGame);
  if (validateScoringSetup(action.pointsPerGame, maxPoints)) return state;
  const servingSide = action.servingSide ?? "home";
  const servingTeam = state.teams.find((team) => team.id === (servingSide === "home" ? match.homeId : match.awayId));
  const receivingSide: Side = servingSide === "home" ? "away" : "home";
  const receivingTeam = state.teams.find((team) => team.id === (receivingSide === "home" ? match.homeId : match.awayId));
  if (!servingTeam || !receivingTeam) return state;
  const serverId = action.servingPlayerId && servingTeam.playerIds.includes(action.servingPlayerId)
    ? action.servingPlayerId
    : servingTeam.playerIds[0];
  const receiverId = action.receivingPlayerId && receivingTeam.playerIds.includes(action.receivingPlayerId)
    ? action.receivingPlayerId
    : receivingTeam.playerIds[0];
  const positions = match.category === "mixed-doubles"
    ? {
        [servingSide]: { right: serverId, left: servingTeam.playerIds.find((id) => id !== serverId) ?? serverId },
        [receivingSide]: { right: receiverId, left: receivingTeam.playerIds.find((id) => id !== receiverId) ?? receiverId },
      }
    : {};
  const started: Match = {
    ...match,
    status: "live",
    courtId: action.courtId,
    pointsPerGame: action.pointsPerGame,
    maxPoints,
    paused: false,
    serving: servingSide,
    servingPlayerId: serverId,
    positions,
    startedAt: new Date().toISOString(),
    completedAt: null,
    games: [{ home: 0, away: 0, winner: null }],
    timeline: [
      ...match.timeline,
      event(match.id, "start", "Match started", { score: { home: 0, away: 0 } }),
    ],
  };
  return replaceMatch(state, started);
}

function scorePoint(
  state: AppState,
  matchId: string,
  side: Side,
  action: Extract<Action, { type: "SCORE_POINT" }> = { type: "SCORE_POINT", matchId, side },
) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "live" || match.paused || !match.homeId || !match.awayId) return state;
  const games = match.games.map((game) => ({ ...game }));
  if (games.length === 0) games.push({ home: 0, away: 0, winner: null });
  const index = games.length - 1;
  const current = games[index];
  if (current.winner) return state;

  const history = [...match.history, snapshot(match)];
  const scored = {
    ...current,
    home: current.home + (side === "home" ? 1 : 0),
    away: current.away + (side === "away" ? 1 : 0),
  };
  const config = { target: match.pointsPerGame, max: match.maxPoints, winBy: match.winBy, bestOf: match.bestOf };
  const winner = gameWinner(scored.home, scored.away, config);
  games[index] = { ...scored, winner };
  const teamName = teamLabel(state, side === "home" ? match.homeId : match.awayId);
  const actionType = action.action ?? "rally";
  const pointText = actionType === "rally"
    ? `${teamName} point. ${scored.home}–${scored.away}`
    : `${actionType === "service-fault" ? "Service fault" : "Fault"}${action.faultBy ? ` by ${teamLabel(state, action.faultBy === "home" ? match.homeId : match.awayId)}` : ""}. ${teamName} awarded the point. ${scored.home}–${scored.away}`;
  let timeline: TimelineEvent[] = [
    ...match.timeline,
    event(match.id, actionType === "rally" ? "point" : "fault", pointText, {
      side,
      gameIndex: index,
      score: { home: scored.home, away: scored.away },
      action: actionType,
      faultBy: action.faultBy,
      faultReason: action.faultReason,
    }),
  ];
  const positionsAfter = { ...(match.positions ?? {}) };
  if (match.category === "mixed-doubles" && match.serving === side && positionsAfter[side]) {
    positionsAfter[side] = { right: positionsAfter[side]!.left, left: positionsAfter[side]!.right };
  }
  const servingPlayerId = side === match.serving
    ? (match.servingPlayerId ?? null)
    : match.category === "mixed-doubles"
      ? (positionsAfter[side]?.[(scored[side] % 2 === 0) ? "right" : "left"] ?? null)
      : (state.teams.find((team) => team.id === (side === "home" ? match.homeId : match.awayId))?.playerIds[0] ?? null);
  let next: Match = { ...match, games, serving: side, servingPlayerId, positions: positionsAfter, history, timeline };

  if (!winner) return replaceMatch(state, next);

  const wins = countGameWins(games);
  timeline = [
    ...timeline,
    event(match.id, "game", `Game ${index + 1} to ${teamName}, ${scored.home}–${scored.away}`, {
      side,
      gameIndex: index,
      score: { home: scored.home, away: scored.away },
    }),
  ];
  const matchSide = wins.home >= gamesNeeded(match.bestOf) ? "home" : wins.away >= gamesNeeded(match.bestOf) ? "away" : null;
  if (matchSide) {
    const winnerId = matchSide === "home" ? match.homeId : match.awayId;
    next = {
      ...next,
      status: "completed",
      winnerId,
      paused: false,
      completedAt: new Date().toISOString(),
      timeline: [...timeline, event(match.id, "match", `${teamLabel(state, winnerId)} win the match`)],
    };
    const completedMatches = state.matches.map((item) => (item.id === match.id ? next : item));
    if (match.category === "womens-singles") {
      const reconciled = reconcileSinglesProgression(completedMatches, state.byes);
      return { ...state, matches: reconciled.matches, byes: reconciled.byes };
    }
    const advanced = applyAdvancement(completedMatches, match.id, winnerId);
    next = { ...next, history: [...history.slice(0, -1), { ...history[history.length - 1], advancement: advanced.advancement }] };
    return { ...state, matches: advanced.matches.map((item) => (item.id === match.id ? next : item)) };
  }

  const nextServingPlayerId = side === match.serving
    ? (match.servingPlayerId ?? servingPlayerId)
    : servingPlayerId;
  if (match.category === "mixed-doubles" && nextServingPlayerId && positionsAfter[winner]) {
    const teamPositions = positionsAfter[winner]!;
    positionsAfter[winner] = teamPositions.right === nextServingPlayerId
      ? teamPositions
      : { right: teamPositions.left, left: teamPositions.right };
  }
  games.push({ home: 0, away: 0, winner: null });
  next = { ...next, games, serving: winner, servingPlayerId: nextServingPlayerId, positions: positionsAfter, timeline };
  return replaceMatch(state, next);
}

function undoPoint(state: AppState, matchId: string) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.history.length === 0) return state;
  const previous = match.history[match.history.length - 1];
  if (match.category === "womens-singles" && match.status === "completed") {
    const blockedIds = match.id.startsWith("WS-M") && Number(match.id.slice(4)) <= 4
      ? ["WS-M5", "WS-M6", "WS-SF", "WS-F"]
      : match.id === "WS-M5" || match.id === "WS-M6"
        ? ["WS-SF", "WS-F"]
        : [];
    if (blockedIds.some((id) => {
      const downstream = state.matches.find((item) => item.id === id);
      return downstream && (downstream.status !== "upcoming" || downstream.games.length > 0);
    })) return state;
  }
  if (previous.advancement) {
    const downstream = state.matches.find((item) => item.id === previous.advancement?.matchId);
    if (downstream && (downstream.status !== "upcoming" || downstream.games.length > 0)) return state;
  }
  const restored: Match = {
    ...match,
    games: previous.games.map((game) => ({ ...game })),
    serving: previous.serving,
    servingPlayerId: previous.servingPlayerId,
    positions: previous.positions,
    status: previous.status,
    winnerId: previous.winnerId,
    completedAt: previous.completedAt ?? null,
    paused: previous.paused,
    timeline: [...match.timeline, event(match.id, "undo", "Last point removed · scoring state restored")],
    history: match.history.slice(0, -1),
  };
  const matches = revertAdvancement(
    state.matches.map((item) => (item.id === match.id ? restored : item)),
    previous.advancement,
    match.winnerId,
  );
  if (match.category === "womens-singles" && match.status === "completed") {
    return rollbackSinglesAllocation({ ...state, matches }, match.id);
  }
  return { ...state, matches };
}

function pauseMatch(state: AppState, matchId: string, paused: boolean) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "live" || match.paused === paused) return state;
  return replaceMatch(state, {
    ...match,
    paused,
    timeline: [...match.timeline, event(match.id, paused ? "pause" : "resume", paused ? "Match paused" : "Match resumed")],
  });
}

function completeGame(state: AppState, matchId: string) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "live" || match.paused) return state;
  const games = match.games.map((game) => ({ ...game }));
  const current = games[games.length - 1];
  if (!current || current.winner) return state;
  if (!isGameComplete(current.home, current.away, { target: match.pointsPerGame, max: match.maxPoints, winBy: match.winBy })) {
    return state;
  }
  const side = current.home > current.away ? "home" : "away";
  return scorePoint(
    replaceMatch(state, { ...match, games: games.slice(0, -1).concat([{ ...current, [side]: Math.max(0, current[side] - 1) }]) }),
    matchId,
    side,
    { type: "SCORE_POINT", matchId, side },
  );
}

function completeMatch(state: AppState, matchId: string) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "live" || !match.homeId || !match.awayId) return state;
  const wins = countGameWins(match.games);
  if (wins.home === wins.away) return state;
  if (Math.max(wins.home, wins.away) < gamesNeeded(match.bestOf)) return state;
  const side = wins.home > wins.away ? "home" : "away";
  const winnerId = side === "home" ? match.homeId : match.awayId;
  const history = [...match.history, snapshot(match)];
  const completed: Match = {
    ...match,
    status: "completed",
    winnerId,
    paused: false,
    history,
    timeline: [...match.timeline, event(match.id, "match", `${teamLabel(state, winnerId)} win the match`)],
  };
  const completedMatches = state.matches.map((item) => (item.id === match.id ? completed : item));
  if (match.category === "womens-singles") {
    const reconciled = reconcileSinglesProgression(completedMatches, state.byes);
    return { ...state, matches: reconciled.matches, byes: reconciled.byes };
  }
  const advanced = applyAdvancement(completedMatches, match.id, winnerId);
  const withHistory: Match = {
    ...completed,
    history: [...history.slice(0, -1), { ...history[history.length - 1], advancement: advanced.advancement }],
  };
  return { ...state, matches: advanced.matches.map((item) => (item.id === match.id ? withHistory : item)) };
}

function deleteCourt(state: AppState, courtId: string) {
  const used = state.matches.some((match) => match.courtId === courtId && match.status === "live");
  if (used) return state;
  return {
    ...state,
    courts: state.courts.filter((court) => court.id !== courtId),
    matches: state.matches.map((match) =>
      match.courtId === courtId && match.status === "upcoming" ? { ...match, courtId: null } : match,
    ),
  };
}

function rollbackSinglesAllocation(state: AppState, sourceId: string): AppState {
  const opening = sourceId.startsWith("WS-M") && Number(sourceId.slice(4)) <= 4;
  if (opening) {
    return {
      ...state,
      matches: state.matches.map((match) => {
        if (match.id === "WS-M5") return { ...match, homeId: null, awayId: null };
        if (match.id === "WS-M6") return { ...match, homeId: null, awayId: "WS09" };
        if (match.id === "WS-SF") return { ...match, homeId: null, awayId: null };
        if (match.id === "WS-F") return { ...match, homeId: null, awayId: null };
        return match;
      }),
      byes: state.byes.filter((bye) => bye.id !== "WS-BYE-ROUND2" && bye.id !== "WS-BYE-FINAL"),
    };
  }
  if (sourceId === "WS-M5" || sourceId === "WS-M6") {
    return {
      ...state,
      matches: state.matches.map((match) => {
        if (match.id === "WS-SF") return { ...match, awayId: null };
        if (match.id === "WS-F") return { ...match, homeId: null };
        return match;
      }),
      byes: state.byes.filter((bye) => bye.id !== "WS-BYE-FINAL"),
    };
  }
  return state;
}

function replaceMatch(state: AppState, match: Match) {
  return { ...state, matches: state.matches.map((item) => (item.id === match.id ? match : item)) };
}

function snapshot(match: Match): ScoreHistoryEntry {
  return {
    games: match.games.map((game) => ({ ...game })),
    serving: match.serving,
    servingPlayerId: match.servingPlayerId ?? null,
    positions: structuredClone(match.positions ?? {}),
    status: match.status,
    winnerId: match.winnerId,
    completedAt: match.completedAt ?? null,
    paused: match.paused,
    advancement: null,
  };
}

function event(
  matchId: string,
  type: TimelineEvent["type"],
  text: string,
  extra?: Pick<TimelineEvent, "side" | "gameIndex" | "score" | "action" | "faultBy" | "faultReason">,
): TimelineEvent {
  return {
    id: `${matchId}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text,
    at: new Date().toISOString(),
    ...extra,
  };
}

function countGameWins(games: Match["games"]) {
  return games.reduce(
    (totals, game) => {
      if (game.winner === "home") totals.home += 1;
      if (game.winner === "away") totals.away += 1;
      return totals;
    },
    { home: 0, away: 0 },
  );
}

function teamLabel(state: AppState, teamId: string | null) {
  return state.teams.find((team) => team.id === teamId)?.name ?? "The winner";
}

function courtBusy(matches: Match[], courtId: string, ignoreId: string) {
  return matches.some((match) => match.id !== ignoreId && match.status === "live" && match.courtId === courtId);
}

function sameCategory(state: AppState, teamId: string | null, category: CategoryId) {
  if (!teamId) return true;
  return state.teams.some((team) => team.id === teamId && team.category === category);
}

function occupiesRound(matches: Match[], candidate: Pick<Match, "id" | "category" | "round" | "homeId" | "awayId">, ignoreId?: string) {
  return matches.some((match) => {
    if (match.id === candidate.id || match.id === ignoreId) return false;
    if (match.category !== candidate.category || match.round !== candidate.round) return false;
    return [candidate.homeId, candidate.awayId].some((id) => id && (id === match.homeId || id === match.awayId));
  });
}

function mergePlayers(current: Player[], incoming: Player[]) {
  const map = new Map(current.map((player) => [player.id, player]));
  for (const player of incoming) map.set(player.id, player);
  return [...map.values()];
}

export function categoryDefaults(category: CategoryId) {
  return CATEGORY_META[category];
}
