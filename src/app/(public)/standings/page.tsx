import type { Metadata } from "next";
import { StandingsBoard } from "@/components/leaderboard/standings-board";

export const metadata: Metadata = {
  title: "Standings",
};

export default function Page() {
  return <StandingsBoard />;
}
