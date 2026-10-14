export type CategoryId = "mixed-doubles" | "womens-singles";

export type Role = "audience" | "umpire" | "admin";

export type RoundId =
  | "preliminary"
  | "round-of-16"
  | "quarterfinal"
  | "semifinal"
  | "final";

export type MatchStatus = "upcoming" | "live" | "completed";

export type Side = "home" | "away";

export interface Player {
  id: string;
  name: string;
  department: string;
}

export interface Team {
  id: string;
  name: string;
  category: CategoryId;
  playerIds: string[];
  seed: number;
}

export interface Court {
  id: string;
  name: string;
  label: string;
}

export interface GameScore {
  home: number;
  away: number;
  winner: Side | null;
}

export interface TimelineEvent {
  id: string;
  type: "start" | "point" | "fault" | "undo" | "game" | "pause" | "resume" | "match";
  text: string;
  at: string;
  side?: Side;
  gameIndex?: number;
  score?: { home: number; away: number };
  action?: "rally" | "service-fault" | "fault";
  faultBy?: Side;
  faultReason?: string;
}

export interface PlayerPositions {
  right: string;
  left: string;
}

export interface ScoreHistoryEntry {
  games: GameScore[];
  serving: Side | null;
  servingPlayerId: string | null;
  positions: Partial<Record<Side, PlayerPositions>>;
  status: MatchStatus;
  winnerId: string | null;
  completedAt?: string | null;
  paused: boolean;
  advancement: {
    matchId: string;
    slot: Side;
    previousId: string | null;
  } | null;
}

export interface Match {
  id: string;
  category: CategoryId;
  round: RoundId;
  status: MatchStatus;
  homeId: string | null;
  awayId: string | null;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  courtId: string | null;
  scheduledAt: string | null;
  pointsPerGame: number;
  maxPoints: number;
  bestOf: 3;
  winBy: number;
  games: GameScore[];
  serving: Side | null;
  servingPlayerId?: string | null;
  positions?: Partial<Record<Side, PlayerPositions>>;
  winnerId: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  nextMatchId: string | null;
  nextSlot: Side | null;
  paused: boolean;
  timeline: TimelineEvent[];
  history: ScoreHistoryEntry[];
}

export interface TournamentConfigState {
  tournament: Tournament;
  players: Player[];
  teams: Team[];
  courts: Court[];
  byes: ByeAssignment[];
}

export interface ByeAssignment {
  id: string;
  category: CategoryId;
  teamId: string;
  skippedRound: RoundId;
  intoMatchId: string;
  slot: Side;
}

export interface Tournament {
  id: string;
  name: string;
  edition: string;
  status: "upcoming" | "live" | "completed";
  startDate: string;
  endDate: string;
  venue: string;
  city: string;
  description: string;
}

export interface AppState {
  schemaVersion: number;
  tournament: Tournament;
  players: Player[];
  teams: Team[];
  courts: Court[];
  matches: Match[];
  byes: ByeAssignment[];
  role: Role;
}
