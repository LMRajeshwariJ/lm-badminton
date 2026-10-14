import type { Metadata } from "next";
import { PracticeMatch } from "@/components/admin/practice-match";

export const metadata: Metadata = { title: "Practice scoring" };

export default function Page() {
  return <PracticeMatch />;
}
