import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-start justify-center px-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">LM-Badminton</p>
      <h1 className="mt-3 font-display text-5xl">That page is out</h1>
      <p className="mt-3 text-muted">The match or screen you asked for is not part of this tournament.</p>
      <Link href="/" className="mt-6 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-[#101608]">
        Back to the tournament
      </Link>
    </div>
  );
}
