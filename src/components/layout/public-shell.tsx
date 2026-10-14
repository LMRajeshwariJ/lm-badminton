"use client";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { useTournament } from "@/context/tournament-context";

const roleCopy = {
  audience: null,
  umpire: "Umpire mode is active. Open the Umpire desk to score matches.",
  admin: "Admin mode is active. Open Manage to update the draw or reset matches.",
} as const;

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { state } = useTournament();
  const note = roleCopy[state.role];

  return (
    <div className="flex min-h-full flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-[#101608]">
        Skip to content
      </a>
      <SiteHeader />
      {note ? (
        <p className="border-b border-sky/20 bg-sky/10 px-4 py-2 text-center text-sm text-sky">{note}</p>
      ) : null}
      <main id="content" className="flex-1 pb-20 lg:pb-0">
        {children}
      </main>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
