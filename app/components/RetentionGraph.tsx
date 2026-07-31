/**
 * A simple line for breath-retention progress.
 *
 * No target line, no goal marker, no comparison to anyone else — just your own
 * numbers over time. Rendered as inline SVG so it costs nothing and works
 * before hydration.
 */
export function RetentionGraph({
  points,
  className = "",
}: {
  points: Array<{ seconds: number; at: number }>;
  className?: string;
}) {
  if (points.length < 2) return null;

  const width = 320;
  const height = 90;
  const padding = 6;

  const values = points.map((p) => p.seconds);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((point, index) => {
    const x =
      padding + (index / (points.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((point.seconds - min) / span) * (height - padding * 2);
    return { x, y, seconds: point.seconds };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L${coords.at(-1)!.x.toFixed(1)},${height} L${coords[0]!.x.toFixed(1)},${height} Z`;

  const best = Math.max(...values);
  const latest = values.at(-1)!;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Your last ${points.length} breath holds, from ${formatSeconds(values[0]!)} to ${formatSeconds(latest)}. Your best is ${formatSeconds(best)}.`}
      >
        <defs>
          <linearGradient id="retention-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-amber)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-amber)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#retention-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-amber-bright)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3.5 : 2}
            fill="var(--color-amber-bright)"
          />
        ))}
      </svg>

      <p className="mt-2 text-xs text-[var(--color-bone-faint)]">
        Your last {points.length} holds. Comfortable progress, not maximum
        effort.
      </p>
    </div>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} minutes ${s} seconds` : `${m} minutes`;
}
