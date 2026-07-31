/**
 * The monthly heatmap.
 *
 * Practised days are illuminated; the rest are simply dark. There is no
 * intensity scale — this is not a productivity grid, and a longer session is
 * not a better day.
 */
export function Heatmap({
  days,
  className = "",
}: {
  days: Array<{ day: string; practiced: boolean }>;
  className?: string;
}) {
  // Pad the front so each column is a clean week starting Sunday.
  const first = days[0];
  const leading = first ? weekdayIndex(first.day) : 0;
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...days,
  ];

  const weeks: Array<Array<{ day: string; practiced: boolean } | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const practicedCount = days.filter((d) => d.practiced).length;

  return (
    <div className={className}>
      <div className="flex gap-1 overflow-x-auto pb-1" aria-hidden="true">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const cell = week[dayIndex];
              if (!cell) {
                return <span key={dayIndex} className="h-3 w-3" />;
              }
              return (
                <span
                  key={cell.day}
                  title={cell.day}
                  className={`h-3 w-3 rounded-[3px] ${
                    cell.practiced
                      ? "bg-[var(--color-amber-bright)]"
                      : "bg-[color-mix(in_oklab,var(--color-bone)_9%,transparent)]"
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm text-[var(--color-bone-muted)]">
        {practicedCount} {practicedCount === 1 ? "day" : "days"} practised in
        the last twelve weeks.
      </p>
    </div>
  );
}

function weekdayIndex(day: string): number {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(parsed) ? 0 : new Date(parsed).getUTCDay();
}
