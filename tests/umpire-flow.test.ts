import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../src/data/initial-state.ts";
import { tournamentReducer } from "../src/reducers/tournament-reducer.ts";
import type { AppState, Match, Side } from "../src/types/index.ts";

function start(state = createInitialState(), id = "m-md-r16-4") {
  return tournamentReducer(state, {
    type: "START_MATCH",
    matchId: id,
    courtId: "court-3",
    pointsPerGame: 5,
    maxPoints: 7,
    servingSide: "home",
    servingPlayerId: "p-md-07a",
    receivingPlayerId: "p-md-08a",
  });
}

function match(state: AppState, id = "m-md-r16-4"): Match {
  const value = state.matches.find((item) => item.id === id);
  assert.ok(value);
  return value;
}

function score(state: AppState, side: Side, extra: { action?: "rally" | "service-fault" | "fault"; faultBy?: Side; faultReason?: string } = {}) {
  return tournamentReducer(state, { type: "SCORE_POINT", matchId: "m-md-r16-4", side, ...extra });
}

test("start initializes a doubles server and both service court positions", () => {
  const next = start();
  const active = match(next);
  assert.equal(active.status, "live");
  assert.equal(active.serving, "home");
  assert.equal(active.servingPlayerId, "p-md-07a");
  assert.deepEqual(active.positions?.home, { right: "p-md-07a", left: "p-md-07b" });
  assert.deepEqual(active.positions?.away, { right: "p-md-08a", left: "p-md-08b" });
  assert.ok(active.startedAt);
});

test("a match cannot start before participants are known or on an occupied court", () => {
  const initial = createInitialState();
  const unresolved = tournamentReducer(initial, {
    type: "START_MATCH", matchId: "m-md-qf-2", courtId: "court-3", pointsPerGame: 15, maxPoints: 21,
  });
  assert.equal(unresolved, initial);
  const occupied = tournamentReducer(initial, {
    type: "START_MATCH", matchId: "m-md-r16-4", courtId: "court-1", pointsPerGame: 15, maxPoints: 21,
  });
  assert.equal(occupied, initial);
});

test("serving side retains server and swaps doubles service courts after its point", () => {
  const next = score(start(), "home");
  const active = match(next);
  assert.equal(active.games[0].home, 1);
  assert.equal(active.serving, "home");
  assert.equal(active.servingPlayerId, "p-md-07a");
  assert.deepEqual(active.positions?.home, { right: "p-md-07b", left: "p-md-07a" });
});

test("receiving side wins the rally, takes service, and selects the correct doubles server", () => {
  const next = score(start(), "away");
  const active = match(next);
  assert.equal(active.serving, "away");
  assert.equal(active.servingPlayerId, "p-md-08b");
  assert.equal(active.games[0].away, 1);
  assert.deepEqual(active.positions?.away, { right: "p-md-08a", left: "p-md-08b" });
});

test("service fault awards the opponent a point and stores the reason", () => {
  const next = score(start(), "home", { action: "service-fault", faultBy: "away", faultReason: "Foot fault" });
  const active = match(next);
  assert.equal(active.games[0].home, 1);
  assert.equal(active.timeline.at(-1)?.type, "fault");
  assert.equal(active.timeline.at(-1)?.action, "service-fault");
  assert.equal(active.timeline.at(-1)?.faultBy, "away");
  assert.equal(active.timeline.at(-1)?.faultReason, "Foot fault");
});

test("singles keeps one server identity and switches service using that player's court", () => {
  let state = tournamentReducer(createInitialState(), {
    type: "START_MATCH",
    matchId: "m-ws-qf-3",
    courtId: "court-3",
    pointsPerGame: 11,
    maxPoints: 15,
    servingSide: "away",
    servingPlayerId: "p-ws-06",
  });
  assert.equal(match(state, "m-ws-qf-3").servingPlayerId, "p-ws-06");
  state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "m-ws-qf-3", side: "home" });
  assert.equal(match(state, "m-ws-qf-3").serving, "home");
  assert.equal(match(state, "m-ws-qf-3").servingPlayerId, "p-ws-05");
  state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "m-ws-qf-3", side: "home" });
  assert.equal(match(state, "m-ws-qf-3").servingPlayerId, "p-ws-05");
  assert.deepEqual(match(state, "m-ws-qf-3").positions, {});
});

test("undo restores score, server, player positions, and timeline", () => {
  const scored = score(start(), "home");
  const reverted = tournamentReducer(scored, { type: "UNDO_POINT", matchId: "m-md-r16-4" });
  const active = match(reverted);
  assert.equal(active.games[0].home, 0);
  assert.equal(active.servingPlayerId, "p-md-07a");
  assert.deepEqual(active.positions?.home, { right: "p-md-07a", left: "p-md-07b" });
  assert.equal(active.history.length, 0);
  assert.equal(active.timeline.at(-1)?.type, "undo");
});

test("pause blocks scoring, resume allows it, and two games advance the winner", () => {
  let state = start();
  state = tournamentReducer(state, { type: "PAUSE_MATCH", matchId: "m-md-r16-4" });
  assert.equal(score(state, "home"), state);
  state = tournamentReducer(state, { type: "RESUME_MATCH", matchId: "m-md-r16-4" });
  for (let point = 0; point < 5; point++) state = score(state, "home");
  assert.equal(match(state).games[1].home, 0);
  for (let point = 0; point < 5; point++) state = score(state, "home");
  const completed = match(state);
  assert.equal(completed.status, "completed");
  assert.equal(completed.winnerId, "t-md-07");
  assert.ok(completed.completedAt);
  assert.equal(state.matches.find((item) => item.id === "m-md-qf-2")?.awayId, "t-md-07");
  assert.equal(tournamentReducer(state, { type: "SCORE_POINT", matchId: completed.id, side: "home" }), state);
});

test("two simultaneous matches score independently and advance into separate slots", () => {
  let state = start();
  state = tournamentReducer(state, { type: "ADD_COURT", court: { id: "court-4", name: "Court 4", label: "Practice" } });
  state = tournamentReducer(state, {
    type: "START_MATCH",
    matchId: "m-ws-qf-3",
    courtId: "court-4",
    pointsPerGame: 5,
    maxPoints: 7,
    servingSide: "away",
    servingPlayerId: "p-ws-06",
  });
  for (let point = 0; point < 10; point++) {
    state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "m-md-r16-4", side: "home" });
    state = tournamentReducer(state, { type: "SCORE_POINT", matchId: "m-ws-qf-3", side: "away" });
  }
  assert.equal(match(state).status, "completed");
  assert.equal(match(state, "m-ws-qf-3").status, "completed");
  assert.equal(state.matches.find((item) => item.id === "m-md-qf-2")?.awayId, "t-md-07");
  assert.equal(state.matches.find((item) => item.id === "m-ws-sf-2")?.homeId, "t-ws-06");
});

test("undoing a completed match clears its bracket slot and is blocked after the next match starts", () => {
  let state = start();
  for (let point = 0; point < 5; point++) state = score(state, "home");
  for (let point = 0; point < 5; point++) state = score(state, "home");
  const undone = tournamentReducer(state, { type: "UNDO_POINT", matchId: "m-md-r16-4" });
  assert.equal(match(undone).status, "live");
  assert.equal(undone.matches.find((item) => item.id === "m-md-qf-2")?.awayId, null);
  const startedNext = {
    ...state,
    matches: state.matches.map((item) => item.id === "m-md-qf-2"
      ? { ...item, status: "live" as const, homeId: "t-md-05", awayId: "t-md-07", games: [{ home: 0, away: 0, winner: null }] }
      : item),
  };
  assert.equal(tournamentReducer(startedNext, { type: "UNDO_POINT", matchId: "m-md-r16-4" }), startedNext);
});
