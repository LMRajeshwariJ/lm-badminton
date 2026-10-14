import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-xl">LM-Badminton</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Live tournament scores, draws, and results sync across connected devices. Umpire and admin access is password protected.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Mixed doubles · Women&apos;s singles</p>
      </div>
      <Separator />
    </footer>
  );
}
