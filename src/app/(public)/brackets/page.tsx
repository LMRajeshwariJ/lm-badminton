import type { Metadata } from "next";
import { BracketView } from "@/components/bracket/bracket-view";

export const metadata: Metadata = {
  title: "Draw & fixtures",
};

export default function Page() {
  return <BracketView />;
}
