import assert from "node:assert/strict";
import test from "node:test";
import { gameWinner, isGameComplete } from "../src/lib/scoring.ts";

const winByTwo = { target: 21, max: 30, winBy: 2 };

test("regular game thresholds and deuce follow target plus two", () => {
  assert.equal(gameWinner(21, 18, winByTwo), "home");
  assert.equal(gameWinner(21, 20, winByTwo), null);
  assert.equal(gameWinner(22, 20, winByTwo), "home");
  assert.equal(gameWinner(29, 29, winByTwo), null);
  assert.equal(gameWinner(30, 29, winByTwo), "home");
});

test("11, 15, and 21 point match formats use their configured caps", () => {
  for (const [target, cap] of [[11, 15], [15, 21], [21, 30]]) {
    assert.equal(isGameComplete(target, target - 2, { target, max: cap, winBy: 2 }), true);
    assert.equal(isGameComplete(target, target - 1, { target, max: cap, winBy: 2 }), false);
    assert.equal(isGameComplete(cap, cap - 1, { target, max: cap, winBy: 2 }), true);
  }
});
