"use client";

import { CalendarDays, House, Medal, Radio, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { href: "/brackets", label: "Bracket", icon: Trophy },
  { href: "/standings", label: "Board", icon: Medal },
  { href: "/teams", label: "Teams", icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 backdrop-blur-xl lg:hidden"
      aria-label="Mobile"
    >
      <ul className="grid grid-cols-6">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-semibold text-muted",
                  active && "text-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
