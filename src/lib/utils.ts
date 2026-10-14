import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Match, Player, Side, Team } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTeam(teams: Team[], id: string | null | undefined) {
  if (!id) return undefined;
  return teams.find((team) => team.id === id);
}

export function getPlayer(players: Player[], id: string) {
  return players.find((player) => player.id === id);
}

export function teamPlayers(team: Team | undefined, players: Player[]) {
  if (!team) return [];
  return team.playerIds
    .map((id) => getPlayer(players, id))
    .filter((player): player is Player => Boolean(player));
}

export function playerLine(team: Team | undefined, players: Player[]) {
  const names = teamPlayers(team, players).map((player) => player.name);
  return names.join(" & ");
}

export function sideTeamId(match: Match, side: Side) {
  return side === "home" ? match.homeId : match.awayId;
}

export function sideName(match: Match, side: Side, teams: Team[]) {
  return getTeam(teams, sideTeamId(match, side))?.name ?? (side === "home" ? match.homePlaceholder : match.awayPlaceholder) ?? "To be decided";
}

export function formatTournamentDates(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00+05:30`);
  const endDate = new Date(`${end}T00:00:00+05:30`);
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const year = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(endDate);
  return `${day.format(startDate)} – ${day.format(endDate)} ${year}`;
}

export function formatKickoff(iso: string | null) {
  if (!iso) return "Time to be set";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function formatClock(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function gameWins(match: Match) {
  return match.games.reduce(
    (totals, game) => {
      if (game.winner === "home") totals.home += 1;
      if (game.winner === "away") totals.away += 1;
      return totals;
    },
    { home: 0, away: 0 },
  );
}

export function currentGame(match: Match) {
  return [...match.games].reverse().find((game) => game.winner === null) ?? null;
}

export function finishedGames(match: Match) {
  return match.games.filter((game) => game.winner !== null);
}

export function pointsLabel(match: Pick<Match, "pointsPerGame" | "maxPoints" | "bestOf">) {
  return `First to ${match.pointsPerGame} · win by 2 · cap ${match.maxPoints} · best of ${match.bestOf}`;
}
