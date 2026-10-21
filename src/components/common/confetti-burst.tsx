export function ConfettiBurst({ strong = false }: { strong?: boolean }) {
  const pieces = strong ? 18 : 10;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: pieces }, (_, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: `${8 + (index * 83) % 88}%`,
            animationDelay: `${(index % 6) * 70}ms`,
            background: index % 2 ? "var(--accent)" : "var(--accent-2)",
          }}
        />
      ))}
    </div>
  );
}
