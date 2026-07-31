import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/share";
import { runtimeFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { loadPracticeStats, loadRetentionStats } from "~/lib/stats.server";
import { ACHIEVEMENT_BY_KEY } from "~/content/achievements";
import { EVENTS, track } from "~/lib/analytics.server";
import {
  CARD_FORMATS,
  CARD_THEMES,
  type CardFormat,
  type CardKind,
  contentFor,
  suggestedCaption,
} from "~/lib/sharecard";
import { Button, Card, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

const KINDS: Array<{ value: CardKind; label: string }> = [
  { value: "minutes", label: "Life Force Minutes" },
  { value: "streak", label: "Streak" },
  { value: "week", label: "This week" },
  { value: "retention", label: "Breath hold" },
  { value: "session", label: "Today's practice" },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);

  const [stats, retention] = await Promise.all([
    loadPracticeStats(env, user),
    loadRetentionStats(env, user.id),
  ]);

  const url = new URL(request.url);
  const achievementKey = url.searchParams.get("key");
  const achievement = achievementKey
    ? ACHIEVEMENT_BY_KEY.get(achievementKey)
    : undefined;

  const requested = params.kind as CardKind;
  const kind: CardKind = KINDS.some((k) => k.value === requested)
    ? requested
    : achievement
      ? "journey"
      : "minutes";

  ctx.waitUntil(
    track(env, {
      name: EVENTS.shareCardViewed,
      orgId: user.org_id,
      userId: user.id,
      props: { kind },
    }),
  );

  return {
    kind,
    values: {
      minutes: stats.lifeForceMinutes,
      streak: stats.currentStreak,
      week: stats.weekOverWeek.thisWeek,
      hold: retention.best,
      title: achievement?.name ?? stats.level.name,
    },
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Share your practice · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export default function Share({ loaderData }: Route.ComponentProps) {
  const { kind: initialKind, values } = loaderData;
  const [searchParams] = useSearchParams();

  const [kind, setKind] = useState<CardKind>(initialKind);
  const [theme, setTheme] = useState(CARD_THEMES[0]!.key);
  const [format, setFormat] = useState<CardFormat>("story");
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">(
    "idle",
  );

  const query = new URLSearchParams({
    kind,
    theme,
    format,
    minutes: String(values.minutes),
    streak: String(values.streak),
    week: String(values.week),
    hold: String(values.hold),
    title: values.title,
  });
  const cardUrl = `/card/${kind}-${theme}-${format}?${query.toString()}`;

  const content = contentFor(kind, values);
  const caption = suggestedCaption(kind, content);

  async function share() {
    try {
      const response = await fetch(cardUrl);
      const blob = await response.blob();
      const file = new File([blob], "breathflow.svg", {
        type: "image/svg+xml",
      });

      // Native share sheet where it exists — one tap to Instagram Stories on
      // the platforms that support it, and the normal sheet everywhere else.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
        setShareState("shared");
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: "BreathFLOW",
          text: caption,
          url: window.location.origin + cardUrl,
        });
        setShareState("shared");
        return;
      }
      await navigator.clipboard.writeText(caption);
      setShareState("copied");
    } catch {
      // A cancelled share sheet is not an error worth reporting.
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-2">
      <header>
        <Link
          to="/progress"
          className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          ← Progress
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-[var(--color-bone)]">
          Share your practice
        </h1>
        <p className="mt-2 text-sm text-[var(--color-bone-muted)]">
          Always optional. Nothing you write in a reflection ever appears here.
        </p>
      </header>

      {/* Preview */}
      <div
        className={`mx-auto overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] ${
          format === "story" ? "max-w-[15rem]" : "max-w-[17rem]"
        }`}
      >
        <img
          src={cardUrl}
          alt={`Share card preview: ${content.statistic} ${content.label}`}
          width={CARD_FORMATS[format].width}
          height={CARD_FORMATS[format].height}
          className="h-auto w-full"
        />
      </div>

      <section>
        <SectionHeading>What to show</SectionHeading>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              aria-pressed={kind === option.value}
              className={`rounded-full border px-4 py-2.5 text-sm transition ${
                kind === option.value
                  ? "border-[var(--color-amber-bright)] bg-[color-mix(in_oklab,var(--color-amber)_18%,transparent)] text-[var(--color-bone)]"
                  : "border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] text-[var(--color-bone-muted)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading>Artwork</SectionHeading>
        <div className="mt-3 flex flex-wrap gap-2">
          {CARD_THEMES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setTheme(option.key)}
              aria-pressed={theme === option.key}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                theme === option.key
                  ? "border-[var(--color-amber-bright)] text-[var(--color-bone)]"
                  : "border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] text-[var(--color-bone-muted)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full"
                style={{
                  background: `linear-gradient(160deg, ${option.stops[0]}, ${option.stops[2]})`,
                }}
              />
              {option.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading>Shape</SectionHeading>
        <div className="mt-3 flex gap-2">
          {(Object.keys(CARD_FORMATS) as CardFormat[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormat(key)}
              aria-pressed={format === key}
              className={`rounded-full border px-4 py-2.5 text-sm transition ${
                format === key
                  ? "border-[var(--color-amber-bright)] bg-[color-mix(in_oklab,var(--color-amber)_18%,transparent)] text-[var(--color-bone)]"
                  : "border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] text-[var(--color-bone-muted)]"
              }`}
            >
              {CARD_FORMATS[key].name}
            </button>
          ))}
        </div>
      </section>

      <Card>
        <SectionHeading>Caption, if you want one</SectionHeading>
        <p className="mt-2 text-[var(--color-bone)]">{caption}</p>
      </Card>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={share}>
          {shareState === "shared"
            ? "Shared"
            : shareState === "copied"
              ? "Caption copied"
              : "Share"}
        </Button>
        <a
          href={cardUrl}
          download={`breathflow-${kind}.svg`}
          className="block py-2 text-center text-sm text-[var(--color-bone-faint)] underline underline-offset-4"
        >
          Download the image
        </a>
      </div>

      <p className="pb-4 text-center text-xs leading-relaxed text-[var(--color-bone-faint)]">
        Sharing is never required, and it never affects your streak.
        {searchParams.get("key")
          ? " This marker is yours whether you post it or not."
          : ""}
      </p>
    </div>
  );
}
