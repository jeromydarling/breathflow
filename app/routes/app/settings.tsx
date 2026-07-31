import { Form, Link, data } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/settings";
import { runtimeFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import { run } from "~/lib/db.server";
import { getAccess } from "~/lib/membership.server";
import { emailIsConfigured, sendEmail } from "~/lib/email.server";
import { INTENTIONS, isValidIntention } from "~/lib/onboarding";
import { isValidTimeZone } from "~/lib/time";
import { Button, Card, FormError, FormNote, HealthDisclaimer, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const access = await getAccess(env, user);

  return {
    user: {
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      intentions: user.intentions.split(",").filter(Boolean),
      reducedMotion: user.reduced_motion === 1,
      isDemo: user.is_demo === 1,
    },
    plan: access.plan,
    entitlement: access.entitlement,
    emailConfigured: emailIsConfigured(env),
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Settings · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);
  const intent = String(form.get("intent") ?? "");

  if (user.is_demo === 1 && intent !== "email-self-test") {
    return data(
      { error: "The demo resets each night, so changes here wouldn't stick." },
      { status: 400 },
    );
  }

  if (intent === "profile") {
    const name = String(form.get("name") ?? "").trim().slice(0, 120);
    const timezone = String(form.get("timezone") ?? "");
    const intentions = form
      .getAll("intention")
      .map(String)
      .filter(isValidIntention)
      .slice(0, 2)
      .join(",");
    const reducedMotion = form.get("reducedMotion") === "on" ? 1 : 0;

    await run(
      env.DB,
      `UPDATE users SET name = ?, timezone = ?, intentions = ?, reduced_motion = ?
        WHERE id = ?`,
      name,
      isValidTimeZone(timezone) ? timezone : user.timezone,
      intentions,
      reducedMotion,
      user.id,
    );
    return data({ note: "Saved." });
  }

  /**
   * The email self-test. Surfaces the provider's verbatim error rather than a
   * paraphrase — when mail is broken, the founder needs the real message.
   */
  if (intent === "email-self-test") {
    const result = await sendEmail(env, {
      to: user.email,
      subject: "BreathFLOW email self-test",
      text: `This is the self-test from your BreathFLOW settings.\n\nIf this arrived, sending works.`,
      template: "self-test",
      transactional: true,
    });

    if (result.status === "sent") {
      return data({ note: `Sent to ${user.email}. Check your inbox.` });
    }
    if (result.status === "skipped_no_key") {
      return data({
        note: "Email is running dark — no RESEND_API_KEY is set, so the message was written to the logs instead of sent. Everything else works normally.",
      });
    }
    return data({ error: `The mail provider said: ${result.detail}` });
  }

  return data({ error: "We didn't recognise that." }, { status: 400 });
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { user, plan, entitlement, emailConfigured } = loaderData;

  return (
    <div className="mx-auto max-w-lg space-y-8 pt-2">
      <header>
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          Settings
        </h1>
      </header>

      {actionData && "note" in actionData ? (
        <FormNote>{actionData.note}</FormNote>
      ) : null}
      {actionData && "error" in actionData ? (
        <FormError>{actionData.error}</FormError>
      ) : null}

      <Form method="post" className="space-y-5">
        <input type="hidden" name="intent" value="profile" />
        <SectionHeading>You</SectionHeading>

        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm text-[var(--color-bone-muted)]">
            Name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={user.name}
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="timezone" className="block text-sm text-[var(--color-bone-muted)]">
            Timezone
          </label>
          <input
            id="timezone"
            name="timezone"
            defaultValue={user.timezone}
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
          />
          <p className="text-xs text-[var(--color-bone-faint)]">
            Your streak is counted against your own midnight, so this matters.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm text-[var(--color-bone-muted)]">
            What you&rsquo;re here for
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTENTIONS.map((intention) => (
              <label
                key={intention.value}
                className="cursor-pointer rounded-full border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] px-4 py-2.5 text-sm text-[var(--color-bone-muted)] transition has-[:checked]:border-[var(--color-amber-bright)] has-[:checked]:bg-[color-mix(in_oklab,var(--color-amber)_18%,transparent)] has-[:checked]:text-[var(--color-bone)]"
              >
                <input
                  type="checkbox"
                  name="intention"
                  value={intention.value}
                  defaultChecked={user.intentions.includes(intention.value)}
                  className="sr-only"
                />
                {intention.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] p-4">
          <input
            type="checkbox"
            name="reducedMotion"
            defaultChecked={user.reducedMotion}
            className="mt-1 h-5 w-5 accent-[var(--color-amber-bright)]"
          />
          <span>
            <span className="block text-[var(--color-bone)]">Reduce motion</span>
            <span className="mt-0.5 block text-sm text-[var(--color-bone-faint)]">
              The breathing orb stays still and paces the breath by light
              instead. Your device&rsquo;s own reduced-motion setting is always
              respected too.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full">
          Save
        </Button>
      </Form>

      <section>
        <SectionHeading>Membership</SectionHeading>
        <Card className="mt-3">
          <p className="text-[var(--color-bone)]">
            {entitlement === "premium" ? "Deep Practice" : "Practice (free)"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-bone-muted)]">
            {plan === "free"
              ? "Everything you need to build the habit."
              : "The full library and the deeper journeys."}
          </p>
          <Button to="/membership" variant="ghost" size="sm" className="mt-4">
            Manage membership
          </Button>
        </Card>
      </section>

      <section>
        <SectionHeading>More</SectionHeading>
        <ul className="mt-3 space-y-2">
          {[
            { to: "/settings/notifications", label: "Notifications" },
            { to: "/settings/account", label: "Your data and account" },
            { to: "/safety", label: "Safety guidance" },
            { to: "/privacy", label: "Privacy" },
            { to: "/terms", label: "Terms" },
          ].map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center justify-between rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] px-5 py-4 text-[var(--color-bone)] transition hover:bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)]"
              >
                {item.label}
                <span aria-hidden="true" className="text-[var(--color-bone-faint)]">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>Email</SectionHeading>
        <Card className="mt-3">
          <p className="text-sm text-[var(--color-bone-muted)]">
            {emailConfigured
              ? "Sending is configured."
              : "Sending is running dark — messages are written to the logs instead. Everything else works normally."}
          </p>
          <Form method="post" className="mt-4">
            <input type="hidden" name="intent" value="email-self-test" />
            <Button type="submit" variant="ghost" size="sm">
              Send myself a test
            </Button>
          </Form>
        </Card>
      </section>

      <Form method="post" action="/logout">
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </Form>

      <HealthDisclaimer className="pb-4" />
    </div>
  );
}
