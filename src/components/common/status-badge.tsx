import { Badge } from "@/components/ui/badge";
import { LiveDot } from "@/components/common/live-dot";
import type { MatchStatus } from "@/types";

const copy: Record<MatchStatus, string> = {
  live: "Live",
  upcoming: "Upcoming",
  completed: "Final",
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  const variant = status === "live" ? "live" : status === "upcoming" ? "upcoming" : "done";
  return (
    <Badge variant={variant}>
      {status === "live" ? <LiveDot /> : null}
      {copy[status]}
    </Badge>
  );
}
