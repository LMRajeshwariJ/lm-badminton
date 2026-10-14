import { ShuttleIcon } from "@/components/common/shuttle";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      <ShuttleIcon className="mx-auto h-10 w-10 text-accent" />
      <h2 className="mt-4 font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}
