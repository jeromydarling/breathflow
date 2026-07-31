import { Link } from "react-router";
import type { Route } from "./+types/progress";
import { envFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import {
  loadEarnedAchievements,
  loadPracticeStats,
  loadRetentionStats,
} from "~/lib/stats.server";
import { ACHIEVEMENTS } from "~/content/achievements";
import { addDays, dayRange } from "~/lib/time";
import { Button, Card, SectionHeading } from "~/components/ui";
import { WeeklyRing } from "~/components/WeeklyRing";
import { Heatmap } from "~/components/Heatmap";
import { RetentionGraph } from "~/components/RetentionGraph";
import { privateNoStore } from "~/lib/cache.server";

/**
 * Progress should feel like witnessing a relationship deepen, not completing
 * chores. So: no dense analytics dashboard, no percentages, no "you're behind".
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await requireOnboardedUser(request, env);

  const [stats, retention, earned] = await Promise.all([
    loadPracticeStats(env, user),
    loadRetentionStats(env, user.id),
    loadEarnedAchievements(env, user.id),
  ]);

  const earnedKeys = new Set(earned.map((a) => a.key));

  return {
    stats: {
      lifeForceMinutes: stats.lifeForceMinutes,
      totalSessions: stats.totalSessions,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      weeklyRing: stats.weeklyRing,
      weekOverWeek: stats.weekOverWeek,
      level: { name: stats.level.name, blessing: stats.level.blessing },
      nextLevel: stats.nextLevel
        ? { name: stats.nextLevel.name, minutes: stats.nextLevel.minutes }
        : null,
      levelProgress: stats.levelProgress,
    },
    // A rolling twelve weeks — enough to see a rhythm, short enough to read.
    heatmap: dayRange(addDays(stats.today, -83), stats.today).map((day) => ({
      day,
      practiced: stats.practicedDays.includes(day),
    })),
    retention: {
      best: retention.best,
      recentAverage: retention.recentAverage,
      count: retention.count,
      points: retention.attempts.map((a) => ({
        seconds: a.seconds,
        at: a.created_at,
      })),
    },
    earned,
    upcoming: ACHIEVEMENTS.filter((a) => !earnedKeys.has(a.key))
      .slice(0, 3)
      .map((a) => ({ key: a.key, name: a.name, hint: a.hint })),
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Progress · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export default function Progress({ loaderData }: Route.ComponentProps) {
  const { stats, heatmap, retention, earned, upcoming } = loaderData;
  const { thisWeek, lastWeek } = stats.weekOverWeek;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          Progress
        </h1>
      </header>

      {/* The headline number, exactly as the brief words it */}
      <Card className="text-center">
        <p className="text-[var(--color-bone-muted)]">You have cultivated</p>
        <p className="mt-2 font-serif text-6xl text-[var(--color-bone)] tabular-nums">
          {stats.lifeForceMinutes.toLocaleString()}
        </p>
        <p className="mt-1 text-[var(--color-bone-muted)]">Life Force Minutes</p>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-[var(--color-bone-faint)]">
            <span>{stats.level.name}</span>
            {stats.nextLevel ? <span>{stats.nextLevel.name}</span> : null}
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-bone)_14%,transparent)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(stats.levelProgress * 100)}
            aria-label={`Progress toward ${stats.nextLevel?.name ?? "the final level"}`}
          >
            <div
              className="h-full rounded-full bg-[var(--color-amber-bright)] transition-[width] duration-700"
              style={{ width: `${stats.levelProgress * 100}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-bone-muted)]">
            {stats.level.blessing}
          </p>
        </div>
      </Card>

      <p className="px-2 text-center text-sm leading-relaxed text-[var(--color-bone-faint)]">
        Consistency changes the body&rsquo;s relationship with stress,
        attention and presence. Keep going gently.
      </p>

      {/* Streaks and week */}
      <Card>
        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Streak" value={stats.currentStreak} unit="days" />
          <Stat label="Longest" value={stats.longestStreak} unit="days" />
          <Stat label="Sessions" value={stats.totalSessions} unit="" />
        </div>

        <WeeklyRing days={stats.weeklyRing} className="mt-6" />

        <p className="mt-5 text-center text-sm text-[var(--color-bone-muted)]">
          {thisWeek} {thisWeek === 1 ? "day" : "days"} this week
          {lastWeek > 0 ? `, ${lastWeek} the week before` : ""}.
        </p>
      </Card>

      <Card>
        <SectionHeading>The last twelve weeks</SectionHeading>
        <Heatmap days={heatmap} className="mt-4" />
      </Card>

      {/* Breath retention */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionHeading>Breath retention</SectionHeading>
            {retention.count > 0 ? (
              <p className="mt-2 text-[var(--color-bone)]">
                Best {formatSeconds(retention.best)} · recent average{" "}
                {formatSeconds(retention.recentAverage)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-bone-muted)]">
                Not logged yet. It is a gentle practice, and there is no number
                you are supposed to hit.
              </p>
            )}
          </div>
        </div>

        {retention.points.length > 1 ? (
          <RetentionGraph points={retention.points} className="mt-5" />
        ) : null}

        <Button
          to="/progress/retention"
          variant="ghost"
          size="sm"
          className="mt-5"
        >
          {retention.count > 0 ? "Log a hold" : "Try the retention tracker"}
        </Button>
      </Card>

      {/* Achievements */}
      <section>
        <SectionHeading>Markers</SectionHeading>

        {earned.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {earned.map((achievement) => (
              <li key={achievement.key}>
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[var(--color-bone)]">
                        {achievement.name}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                        {achievement.description}
                      </p>
                    </div>
                    {achievement.shareable ? (
                      <Link
                        to={`/progress/share/achievement?key=${achievement.key}`}
                        className="shrink-0 text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
                      >
                        Share
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-bone-muted)]">
            Your first marker arrives with your first practice.
          </p>
        )}

        {upcoming.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {upcoming.map((achievement) => (
              <li
                key={achievement.key}
                className="rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] px-5 py-4"
              >
                <p className="text-sm text-[var(--color-bone-muted)]">
                  {achievement.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-bone-faint)]">
                  {achievement.hint}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Button to="/progress/share/minutes" variant="ghost" className="w-full">
        Make a share card
      </Button>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-bone-faint)]">
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl text-[var(--color-bone)] tabular-nums">
        {value.toLocaleString()}
      </p>
      {unit ? (
        <p className="text-xs text-[var(--color-bone-faint)]">{unit}</p>
      ) : null}
    </div>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
