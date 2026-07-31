import { Form, Link, data } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/settings-notifications";
import { runtimeFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { one, run } from "~/lib/db.server";
import { suppress, unsuppress } from "~/lib/email.server";
import { EVENTS, track } from "~/lib/analytics.server";
import { Button, Card, FormNote, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * Notification settings.
 *
 * At most one routine reminder a day, chosen by the user, never guilt-based,
 * and turned off in one click with no dark-pattern confirmation step.
 */
const HOURS = [
  { value: 5, label: "5:00 am" },
  { value: 6, label: "6:00 am" },
  { value: 7, label: "7:00 am" },
  { value: 8, label: "8:00 am" },
  { value: 9, label: "9:00 am" },
  { value: 12, label: "12:00 pm" },
  { value: 17, label: "5:00 pm" },
  { value: 20, label: "8:00 pm" },
  { value: 21, label: "9:00 pm" },
] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);

  const suppressed = await one(
    env.DB,
    `SELECT 1 AS ok FROM email_suppressions WHERE email = ?`,
    user.email.toLowerCase(),
  );

  return {
    reminderHour: user.reminder_hour,
    timezone: user.timezone,
    unsubscribed: suppressed !== null,
    isDemo: user.is_demo === 1,
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Notifications · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);

  if (user.is_demo === 1) {
    return data({ note: "The demo resets each night, so this wouldn't stick." });
  }

  const raw = form.get("reminderHour");
  const hour = raw === "off" || raw === null ? null : Number(raw);
  const valid =
    hour === null ||
    (Number.isInteger(hour) && hour >= 0 && hour <= 23);

  await run(
    env.DB,
    `UPDATE users SET reminder_hour = ? WHERE id = ?`,
    valid ? hour : null,
    user.id,
  );

  // Choosing a reminder implies wanting mail; turning it off does not by
  // itself unsubscribe you from everything.
  if (hour !== null) {
    await unsuppress(env, user.email);
    ctx.waitUntil(
      track(env, {
        name: EVENTS.notificationOptIn,
        orgId: user.org_id,
        userId: user.id,
        props: { hour },
      }),
    );
  }

  if (form.get("unsubscribeAll") === "on") {
    await suppress(env, user.email, "unsubscribed");
    return data({
      note: "You're unsubscribed from everything except account emails like password resets. Your practice is untouched.",
    });
  }

  return data({
    note: hour === null ? "Reminders are off." : "Saved.",
  });
}

export default function NotificationSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { reminderHour, timezone, unsubscribed } = loaderData;

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-2">
      <header>
        <Link
          to="/settings"
          className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          ← Settings
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-[var(--color-bone)]">
          Notifications
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-bone-muted)]">
          One gentle reminder a day at most, and only on days you haven&rsquo;t
          practised yet. Never guilt, never a countdown.
        </p>
      </header>

      {actionData && "note" in actionData ? (
        <FormNote>{actionData.note}</FormNote>
      ) : null}

      <Form method="post" className="space-y-6">
        <fieldset>
          <legend className="text-sm text-[var(--color-bone-muted)]">
            Remind me at
          </legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="cursor-pointer rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] px-3 py-3 text-center text-sm text-[var(--color-bone-muted)] transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_18%,transparent)] has-[:checked]:text-[var(--color-bone)]">
              <input
                type="radio"
                name="reminderHour"
                value="off"
                defaultChecked={reminderHour === null}
                className="sr-only"
              />
              Off
            </label>
            {HOURS.map((hour) => (
              <label
                key={hour.value}
                className="cursor-pointer rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] px-3 py-3 text-center text-sm text-[var(--color-bone-muted)] transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_18%,transparent)] has-[:checked]:text-[var(--color-bone)]"
              >
                <input
                  type="radio"
                  name="reminderHour"
                  value={hour.value}
                  defaultChecked={reminderHour === hour.value}
                  className="sr-only"
                />
                {hour.label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--color-bone-faint)]">
            Times are in {timezone}.
          </p>
        </fieldset>

        <label className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] p-4">
          <input
            type="checkbox"
            name="unsubscribeAll"
            defaultChecked={unsubscribed}
            className="mt-1 h-5 w-5 accent-[var(--color-amber-bright)]"
          />
          <span>
            <span className="block text-[var(--color-bone)]">
              Unsubscribe from everything
            </span>
            <span className="mt-0.5 block text-sm text-[var(--color-bone-faint)]">
              No reminders, no milestone notes. Account emails like password
              resets still come through, because you need those.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full">
          Save
        </Button>
      </Form>

      <Card>
        <SectionHeading>What we&rsquo;d send</SectionHeading>
        <ul className="mt-3 space-y-2 text-sm text-[var(--color-bone-muted)]">
          <li>· &ldquo;Your breath is waiting.&rdquo;</li>
          <li>
            · &ldquo;Three conscious minutes can change the direction of this
            moment.&rdquo;
          </li>
          <li>· A note when you cross a real milestone.</li>
        </ul>
      </Card>
    </div>
  );
}
