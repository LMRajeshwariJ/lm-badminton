import type { Metadata } from "next";
import { HomePage } from "@/components/home/home-page";

export const metadata: Metadata = {
  title: { absolute: "LM-Badminton" },
  description: "Live office badminton championship for mixed doubles and women's singles.",
};

export default function Page() {
  return <HomePage />;
}
