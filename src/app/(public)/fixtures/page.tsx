import type { Metadata } from "next";
import { FixtureBoard } from "@/components/fixtures/fixture-board";

export const metadata: Metadata = {
  title: "Fixtures",
};

export default function Page() {
  return <FixtureBoard />;
}
