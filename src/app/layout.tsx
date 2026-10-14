import type { Metadata } from "next";
import { TournamentProvider } from "@/context/tournament-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LM-Badminton",
    template: "%s · LM-Badminton",
  },
  description: "Office badminton championship for mixed doubles and women's singles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background font-sans text-foreground">
        <TournamentProvider>{children}</TournamentProvider>
      </body>
    </html>
  );
}
