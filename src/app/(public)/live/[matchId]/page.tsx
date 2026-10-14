import type { Metadata } from "next";
import { LiveScoreboard } from "@/components/scoreboard/live-scoreboard";

export const metadata: Metadata = {
  title: "Match",
};

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <LiveScoreboard matchId={matchId} />;
}
