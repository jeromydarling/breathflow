const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export type RingDay = {
  day: string;
  practiced: boolean;
  isToday: boolean;
};

/**
 * The seven-day consistency row.
 *
 * A practised day is a filled ring; an unpractised one is an outline. There is
 * deliberately no red, no "missed" label and no gap-shaming — the empty ring
 * says everything it needs to.
 */
export function WeeklyRing({
  days,
  className = "",
}: {
  days: RingDay[];
  className?: string;
}) {
  const practicedCount = days.filter((d) => d.practiced).length;

  return (
    <div className={className}>
      <ul className="flex justify-between gap-1.5">
        {days.map((day) => {
          const initial = DAY_INITIALS[weekdayIndex(day.day)] ?? "";
          return (
            <li key={day.day} className="flex flex-1 flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-8 w-8 rounded-full border-2 transition ${
                  day.practiced
                    ? "border-[var(--color-amber-bright)] bg-[color-mix(in_oklab,var(--color-amber)_38%,transparent)]"
                    : "border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)]"
                } ${day.isToday ? "ring-2 ring-[color-mix(in_oklab,var(--color-bone)_30%,transparent)] ring-offset-2 ring-offset-transparent" : ""}`}
              />
              <span
                aria-hidden="true"
                className={`text-[0.68rem] ${
                  day.isToday
                    ? "text-[var(--color-bone)]"
                    : "text-[var(--color-bone-faint)]"
                }`}
              >
                {initial}
              </span>
            </li>
          );
        })}
      </ul>

      {/* One clear sentence for screen readers rather than fourteen fragments. */}
      <p className="sr-only">
        {practicedCount} of the last seven days practised.
      </p>
    </div>
  );
}

/** 0 = Sunday, matching DAY_INITIALS. */
function weekdayIndex(day: string): number {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(parsed) ? 0 : new Date(parsed).getUTCDay();
}
