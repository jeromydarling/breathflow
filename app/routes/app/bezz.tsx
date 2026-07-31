import { Form, Link } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/bezz";
import { runtimeFrom } from "~/lib/context";
import { requireOnboardedUser } from "~/lib/auth.server";
import {
  BIO_FULL,
  CONVERSION_PATHS,
  CREDENTIALS_VERIFIED,
  CREDENTIALS_PENDING_VERIFICATION,
  TEACHINGS,
} from "~/content/bezz";
import { EVENTS, track } from "~/lib/analytics.server";
import { Button, Card, HealthDisclaimer, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * The relationship hub. Personal and human, not a sales page.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = runtimeFrom(context);
  await requireOnboardedUser(request, env);

  return {
    bio: BIO_FULL,
    // Unverified credentials stay out of production until the founder signs
    // them off. See app/content/bezz.ts.
    credentials: CREDENTIALS_VERIFIED
      ? CREDENTIALS_PENDING_VERIFICATION
      : null,
    teachings: TEACHINGS,
    paths: CONVERSION_PATHS.map((path) => ({
      ...path,
      url: path.urlVar ? (env[path.urlVar] ?? "") : "",
    })),
    instagram: env.INSTAGRAM_URL ?? "",
    supportEmail: env.SUPPORT_EMAIL,
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Bezz · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

/** Records a booking click so the team knows the app is driving bookings. */
export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);

  ctx.waitUntil(
    track(env, {
      name: EVENTS.bookingClicked,
      orgId: user.org_id,
      userId: user.id,
      props: { path: String(form.get("path") ?? "") },
    }),
  );

  return { tracked: true };
}

export default function Bezz({ loaderData }: Route.ComponentProps) {
  const { bio, credentials, teachings, paths, instagram, supportEmail } =
    loaderData;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">Bezz</h1>
        <p className="mt-1 text-sm text-[var(--color-bone-faint)]">
          The person behind the practice.
        </p>
      </header>

      {/* Founder video slot. Renders as a placeholder until the file exists,
          rather than a broken player. */}
      <div className="bf-ember relative flex aspect-video items-center justify-center overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative text-center">
          <p className="font-serif text-xl text-[var(--color-bone)]">
            Why I created BreathFLOW
          </p>
          <p className="mt-2 text-sm text-[var(--color-bone-muted)]">
            Coming soon
          </p>
        </div>
      </div>

      <section>
        <SectionHeading>About</SectionHeading>
        <div className="mt-3 space-y-4">
          {bio.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="leading-[1.75] text-[var(--color-bone-muted)]"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {credentials ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-bone-faint)]">
            {credentials.certification}. Has studied with{" "}
            {credentials.teachers.join(" and ")}, and facilitated at{" "}
            {credentials.venues.join(", ")}.
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeading>Short teachings</SectionHeading>
        <ul className="mt-3 space-y-2">
          {teachings.map((teaching) => (
            <li
              key={teaching.slug}
              className="rounded-2xl border border-[color-mix(in_oklab,var(--color-bone)_14%,transparent)] p-5"
            >
              <p className="text-[var(--color-bone)]">{teaching.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                {teaching.blurb}
              </p>
              <p className="mt-2 text-xs text-[var(--color-bone-faint)]">
                {teaching.length} min · coming soon
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>Work with Bezz</SectionHeading>
        <ul className="mt-3 space-y-3">
          {paths.map((path) => (
            <li key={path.key}>
              <Card>
                <h3 className="text-lg text-[var(--color-bone)]">
                  {path.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-bone-muted)]">
                  {path.description}
                </p>

                {path.url ? (
                  // A configured booking link. The click is recorded so the
                  // team knows bookings originated in the app.
                  <Form method="post" className="mt-4">
                    <input type="hidden" name="path" value={path.key} />
                    <button
                      type="submit"
                      formTarget="_blank"
                      onClick={() => window.open(path.url, "_blank", "noopener")}
                      className="rounded-full bg-[var(--color-bone)] px-5 py-2.5 text-sm font-medium text-[var(--color-charcoal)]"
                    >
                      {path.cta}
                    </button>
                  </Form>
                ) : (
                  <Button
                    to={`/bezz/ask?category=${encodeURIComponent(path.askCategory ?? "")}`}
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                  >
                    {path.cta}
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>Ask a question</SectionHeading>
        <Card className="mt-3">
          <p className="text-sm leading-relaxed text-[var(--color-bone-muted)]">
            About your practice, a session, a retreat, or anything that
            isn&rsquo;t working. Real replies from real people.
          </p>
          <Button to="/bezz/ask" size="sm" className="mt-4">
            Write to Bezz
          </Button>
        </Card>
      </section>

      <section>
        <SectionHeading>Elsewhere</SectionHeading>
        <ul className="mt-3 space-y-2 text-sm">
          {instagram ? (
            <li>
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
              >
                Instagram
              </a>
            </li>
          ) : null}
          <li>
            <a
              href={`mailto:${supportEmail}`}
              className="text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
            >
              {supportEmail}
            </a>
          </li>
        </ul>
      </section>

      <section className="border-t border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] pt-6">
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {[
            { to: "/safety", label: "Safety" },
            { to: "/privacy", label: "Privacy" },
            { to: "/terms", label: "Terms" },
            { to: "/settings", label: "Settings" },
          ].map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <HealthDisclaimer className="mt-6" />
      </section>
    </div>
  );
}
