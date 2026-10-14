import type { Metadata } from "next";
import { ScoringConsole } from "@/components/umpire/scoring-console";

export const metadata: Metadata = { title: "Scoring console" };

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <ScoringConsole matchId={matchId} />;
}
