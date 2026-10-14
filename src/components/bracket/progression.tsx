import { categoryProgress } from "@/lib/bracket";
import { CATEGORY_META } from "@/lib/constants";
import type { ByeAssignment, CategoryId, Match } from "@/types";

export function Progression({
  category,
  matches,
  byes,
}: {
  category: CategoryId;
  matches: Match[];
  byes: ByeAssignment[];
}) {
  const stages = categoryProgress(category, matches, byes);
  const meta = CATEGORY_META[category];
  const accent = category === "mixed-doubles" ? "bg-accent" : "bg-sky";

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${category === "mixed-doubles" ? "text-accent" : "text-sky"}`}>
        {meta.label}
      </p>
      <h3 className="mt-1 font-display text-2xl">Path to the title</h3>
      <ol className="mt-5">
        {stages.map((stage, index) => (
          <li key={stage.id} className="grid grid-cols-[28px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-3 w-3 rounded-full ${
                  stage.state === "upcoming" ? "bg-white/20" : accent
                } ${stage.state === "current" ? "ring-4 ring-accent/20" : ""}`}
              />
              {index < stages.length - 1 ? <span className="w-px flex-1 bg-white/10" /> : null}
            </div>
            <div className="pb-4">
              <p className="font-display text-lg leading-none">{stage.label}</p>
              <p className="mt-1 text-sm text-muted">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
