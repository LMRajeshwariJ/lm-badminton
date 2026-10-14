import { CATEGORY_META } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import type { CategoryId } from "@/types";

export function CategoryBadge({ category }: { category: CategoryId }) {
  return <Badge variant={category === "mixed-doubles" ? "lime" : "sky"}>{CATEGORY_META[category].label}</Badge>;
}
