import type { Metadata } from "next";
import { BracketView } from "@/components/bracket/bracket-view";

export const metadata: Metadata = {
  title: "Brackets",
};

export default function Page() {
  return <BracketView />;
}
