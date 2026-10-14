import type { Metadata } from "next";
import { LiveIndex } from "@/components/scoreboard/live-index";

export const metadata: Metadata = {
  title: "Live matches",
};

export default function Page() {
  return <LiveIndex />;
}
