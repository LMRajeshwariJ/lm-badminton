import type { Metadata } from "next";
import { TeamsBoard } from "@/components/teams/teams-board";

export const metadata: Metadata = {
  title: "Teams",
};

export default function Page() {
  return <TeamsBoard />;
}
