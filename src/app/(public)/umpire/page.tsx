import type { Metadata } from "next";
import { UmpireDashboard } from "@/components/umpire/umpire-dashboard";

export const metadata: Metadata = { title: "Umpire desk" };

export default function Page() {
  return <UmpireDashboard />;
}
