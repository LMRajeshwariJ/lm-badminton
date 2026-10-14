import { createInitialState } from "../src/data/initial-state";
import { generateKnockout, validateCategory } from "../src/lib/bracket";
import { isGameComplete } from "../src/lib/scoring";
import { buildStandings } from "../src/lib/standings";

const state = createInitialState();

for (const category of ["mixed-doubles", "womens-singles"] as const) {
  const check = validateCategory(category, state.teams, state.matches, state.byes);
  if (!check.ok) {
    console.error(category, check.issues);
    process.exitCode = 1;
  } else {
    console.log(`${category} draw ok`);
  }
  const rows = buildStandings(category, state.teams, state.matches, state.byes);
  console.log(
    category,
    "top",
    rows.slice(0, 3).map((row) => `${row.team.name} (${row.stage})`),
  );
}

const mixed = generateKnockout("mixed-doubles", state.teams);
const singles = generateKnockout("womens-singles", state.teams);
if (!mixed.ok || !singles.ok) {
  console.error("generate failed", mixed, singles);
  process.exitCode = 1;
} else {
  const mixedCheck = validateCategory("mixed-doubles", state.teams, mixed.draw.matches, mixed.draw.byes);
  const singlesCheck = validateCategory("womens-singles", state.teams, singles.draw.matches, singles.draw.byes);
  console.log("generated mixed", mixedCheck.ok ? "ok" : mixedCheck.issues);
  console.log("generated singles", singlesCheck.ok ? "ok" : singlesCheck.issues);
  if (!mixedCheck.ok || !singlesCheck.ok) process.exitCode = 1;
}

const samples: Array<[number, number, number, number, boolean]> = [
  [15, 12, 15, 21, true],
  [15, 14, 15, 21, false],
  [16, 14, 15, 21, true],
  [20, 20, 15, 21, false],
  [21, 20, 15, 21, true],
  [11, 8, 11, 15, true],
  [11, 10, 11, 15, false],
  [12, 10, 11, 15, true],
  [14, 14, 11, 15, false],
  [15, 14, 11, 15, true],
];

for (const [home, away, target, max, expected] of samples) {
  const actual = isGameComplete(home, away, { target, max, winBy: 2 });
  if (actual !== expected) {
    console.error(`score ${home}-${away} target ${target} expected ${expected} got ${actual}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) console.log("scoring samples ok");
