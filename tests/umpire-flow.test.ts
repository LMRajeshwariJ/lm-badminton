import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../src/data/initial-state.ts";
import { tournamentReducer } from "../src/reducers/tournament-reducer.ts";
import type { AppState, Match, Side } from "../src/types/index.ts";

function start(state = createInitialState(), id = "MD-R16-4") {
  return tournamentReducer(state, {
    type: "START_MATCH",
    matchId: id,
    courtId: "court-3",
    pointsPerGame: 5,
    maxPoints: 7,
    servingSide: "home",
    servingPlayerId: "T07-P1",
    receivingPlayerId: "T08-P1",
  });
}

function match(state: AppState, id = "MD-R16-4"): Match {
  const value = state.matches.find((item) => item.id === id);
  assert.ok(value);
  return value;
}

function score(state: AppState, side: Side) {
  return tournamentReducer(state, { type: "SCORE_POINT", matchId: "MD-R16-4", side });
}

test("start initializes a doubles server and both service court positions", () => {
  const next = start();
  const active = match(next);
  assert.equal(active.status, "live");
  assert.equal(active.serving, "home");
  assert.equal(active.servingPlayerId, "T07-P1");
  assert.deepEqual(active.positions?.home, { right: "T07-P1", left: "T07-P2" });
  assert.deepEqual(active.positions?.away, { right: "T08-P1", left: "T08-P2" });
  assert.ok(active.startedAt);
});

test("a match cannot start before participants are known or on an occupied court", () => {
  const initial = createInitialState();
  const unresolved = tournamentReducer(initial, {
    type: "START_MATCH", matchId: "MD-QF2", courtId: "court-3", pointsPerGame: 15, maxPoints: 21,
  });
  assert.equal(unresolved, initial);
  const courtInUse = tournamentReducer(initial, {
    type: "START_MATCH", matchId: "MD-R16-1", courtId: "court-1", pointsPerGame: 15, maxPoints: 21,
  });
  const occupied = tournamentReducer(courtInUse, {
    type: "START_MATCH", matchId: "MD-R16-4", courtId: "court-1", pointsPerGame: 15, maxPoints: 21,
  });
  assert.equal(occupied, courtInUse);
});

test("serving side retains server and swaps doubles service courts after its point", () => {
  const next = score(start(), "home");
  const active = match(next);
  assert.equal(active.games[0].home, 1);
  assert.equal(active.serving, "home");
  assert.equal(active.servingPlayerId, "T07-P1");
  assert.deepEqual(active.positions?.home, { right: "T07-P2", left: "T07-P1" });
});

test("receiving side wins the rally, takes service, and selects the correct doubles server", () => {
  const next = score(start(), "away");
  const active = match(next);
  assert.equal(active.serving, "away");
  assert.equal(active.servingPlayerId, "T08-P2");
  assert.equal(active.games[0].away, 1);
  assert.deepEqual(active.positions?.away, { right: "T08-P1", left: "T08-P2" });
});

test("manual point scoring records a normal point event", () => {
  const next = score(start(), "home");
  const active = match(next);
  assert.equal(active.games[0].home, 1);
  assert.equal(active.timeline.at(-1)?.type, "point");
  assert.match(active.timeline.at(-1)?.text ?? "", /point/);
});

test("singles keeps one server identity and switches service using that player's court", () => {
  let state = tournamentReducer(createInitialState(), {
    type: "START_MATCH",
    matchId: "WS-M1",
    courtId: "court-3",
    pointsPerGame: 11,
    maxPoints: 15,
    servingSide: "away",
    servingPlayerId: "WS02-P1",
  });
  assert.equal(match(state, "WS-M1").servingPlayerId, "WS02-P1");
  state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "WS-M1", side: "home" });
  assert.equal(match(state, "WS-M1").serving, "home");
  assert.equal(match(state, "WS-M1").servingPlayerId, "WS01-P1");
  state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "WS-M1", side: "home" });
  assert.equal(match(state, "WS-M1").servingPlayerId, "WS01-P1");
  assert.deepEqual(match(state, "WS-M1").positions, {});
});

test("undo restores score, server, player positions, and timeline", () => {
  const scored = score(start(), "home");
  const reverted = tournamentReducer(scored, { type: "UNDO_POINT", matchId: "MD-R16-4" });
  const active = match(reverted);
  assert.equal(active.games[0].home, 0);
  assert.equal(active.servingPlayerId, "T07-P1");
  assert.deepEqual(active.positions?.home, { right: "T07-P1", left: "T07-P2" });
  assert.equal(active.history.length, 0);
  assert.equal(active.timeline.at(-1)?.type, "undo");
});

test("pause blocks scoring, resume allows it, and two games advance the winner", () => {
  let state = start();
  state = tournamentReducer(state, { type: "PAUSE_MATCH", matchId: "MD-R16-4" });
  assert.equal(score(state, "home"), state);
  state = tournamentReducer(state, { type: "RESUME_MATCH", matchId: "MD-R16-4" });
  for (let point = 0; point < 5; point++) state = score(state, "home");
  assert.equal(match(state).games[1].home, 0);
  for (let point = 0; point < 5; point++) state = score(state, "home");
  const completed = match(state);
  assert.equal(completed.status, "completed");
  assert.equal(completed.winnerId, "T07");
  assert.ok(completed.completedAt);
  assert.equal(state.matches.find((item) => item.id === "MD-QF2")?.awayId, "T07");
  assert.equal(tournamentReducer(state, { type: "SCORE_POINT", matchId: completed.id, side: "home" }), state);
});

test("two simultaneous matches score independently and advance into separate slots", () => {
  let state = start();
  state = tournamentReducer(state, { type: "ADD_COURT", court: { id: "court-4", name: "Court 4", label: "Practice" } });
  state = tournamentReducer(state, {
    type: "START_MATCH",
    matchId: "WS-M1",
    courtId: "court-4",
    pointsPerGame: 5,
    maxPoints: 7,
    servingSide: "away",
    servingPlayerId: "WS02-P1",
  });
  for (let point = 0; point < 10; point++) {
    state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "MD-R16-4", side: "home" });
    state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "WS-M1", side: "away" });
  }
  assert.equal(match(state).status, "completed");
  assert.equal(match(state, "WS-M1").status, "completed");
  assert.equal(state.matches.find((item) => item.id === "MD-QF2")?.awayId, "T07");
});

test("undoing a completed match clears its bracket slot and is blocked after the next match starts", () => {
  let state = start();
  for (let point = 0; point < 5; point++) state = score(state, "home");
  for (let point = 0; point < 5; point++) state = score(state, "home");
  const undone = tournamentReducer(state, { type: "UNDO_POINT", matchId: "MD-R16-4" });
  assert.equal(match(undone).status, "live");
  assert.equal(undone.matches.find((item) => item.id === "MD-QF2")?.awayId, null);
  const startedNext = {
    ...state,
    matches: state.matches.map((item) => item.id === "MD-QF2"
      ? { ...item, status: "live" as const, homeId: "T06", awayId: "T07", games: [{ home: 0, away: 0, winner: null }] }
      : item),
  };
  assert.equal(tournamentReducer(startedNext, { type: "UNDO_POINT", matchId: "MD-R16-4" }), startedNext);
});
