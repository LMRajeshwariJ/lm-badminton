"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { ShuttleIcon } from "@/components/common/shuttle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/fixtures", label: "Fixtures" },
  { href: "/brackets", label: "Brackets" },
  { href: "/standings", label: "Standings" },
  { href: "/teams", label: "Teams" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-lg tracking-tight">
          <ShuttleIcon className="h-6 w-6 text-accent" />
          LM-Badminton
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Tournament">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground",
                  active && "bg-white/5 text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
}
