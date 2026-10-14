import { courts } from "@/data/courts";
import { byes, matches } from "@/data/matches";
import { players } from "@/data/players";
import { teams } from "@/data/teams";
import { tournament } from "@/data/tournament";
import { SCHEMA_VERSION } from "@/lib/constants";
import type { AppState } from "@/types";

export function createInitialState(): AppState {
  return structuredClone({
    schemaVersion: SCHEMA_VERSION,
    tournament,
    players,
    teams,
    courts,
    matches,
    byes,
    role: "audience",
  });
}
