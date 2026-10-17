import Link from "next/link";
import { AnimatedScore } from "@/components/common/animated-score";
import { CategoryBadge } from "@/components/common/category-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { ROUND_LABEL } from "@/lib/constants";
import { currentGame, finishedGames, gameWins, playerLine, sideName } from "@/lib/utils";
import type { Match, Player, Team } from "@/types";

export function MatchCard({
  match,
  teams,
  players,
  courtName,
  featured = false,
}: {
  match: Match;
  teams: Team[];
  players: Player[];
  courtName?: string | null;
  featured?: boolean;
}) {
  const wins = gameWins(match);
  const liveGame = currentGame(match);
  const homeScore = match.status === "live" && liveGame ? liveGame.home : match.status === "completed" ? wins.home : null;
  const awayScore = match.status === "live" && liveGame ? liveGame.away : match.status === "completed" ? wins.away : null;
  const accent = match.category === "mixed-doubles" ? "before:bg-accent" : "before:bg-sky";

  return (
    <Link
      href={`/live/${match.id}`}
      className={`group relative block overflow-hidden rounded-3xl border border-line bg-surface p-4 transition duration-200 before:absolute before:inset-y-0 before:left-0 before:w-1 hover:-translate-y-0.5 hover:border-white/20 ${accent} ${featured ? "p-5" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 pl-2">
        <CategoryBadge category={match.category} />
        <StatusBadge status={match.status} />
        <span className="text-xs text-muted">{ROUND_LABEL[match.round]}</span>
        {courtName ? <span className="text-xs text-muted">{courtName}</span> : null}
      </div>
      <div className="mt-4 space-y-3 pl-2">
        <SideRow
          name={sideName(match, "home", teams)}
          players={playerLine(teams.find((team) => team.id === match.homeId), players)}
          score={homeScore}
          leading={homeScore !== null && awayScore !== null && homeScore > awayScore}
          serving={match.status === "live" && match.serving === "home"}
          featured={featured}
        />
        <SideRow
          name={sideName(match, "away", teams)}
          players={playerLine(teams.find((team) => team.id === match.awayId), players)}
          score={awayScore}
          leading={homeScore !== null && awayScore !== null && awayScore > homeScore}
          serving={match.status === "live" && match.serving === "away"}
          featured={featured}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 pl-2 text-xs text-muted">
        {match.status === "live" ? <span>Game {finishedGames(match).length + 1}</span> : null}
        {match.status === "completed" ? <span>Games</span> : null}
        {finishedGames(match).map((game, index) => (
          <span key={`${match.id}-g-${index}`} className="rounded-full bg-white/5 px-2 py-1 tabular-nums text-foreground">
            {game.home}–{game.away}
          </span>
        ))}
        {match.status === "upcoming" ? <span>Listed in the tournament draw</span> : null}
      </div>
    </Link>
  );
}

function SideRow({
  name,
  players,
  score,
  leading,
  serving,
  featured,
}: {
  name: string;
  players: string;
  score: number | null;
  leading: boolean;
  serving: boolean;
  featured: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={`truncate font-display tracking-tight ${featured ? "text-2xl" : "text-lg"} ${leading ? "text-foreground" : "text-foreground/90"}`}>
          {name}
          {serving ? <span className="ml-2 text-xs font-sans font-semibold uppercase tracking-[0.14em] text-accent">Serve</span> : null}
        </p>
        {players ? <p className="truncate text-sm text-muted">{players}</p> : null}
      </div>
      <p className={`font-display tabular-nums ${featured ? "text-5xl" : "text-3xl"} ${score === null ? "text-muted" : "text-foreground"}`}>
        {score === null ? "–" : <AnimatedScore value={score} />}
      </p>
    </div>
  );
}
