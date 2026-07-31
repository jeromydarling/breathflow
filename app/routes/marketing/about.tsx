import type { Route } from "./+types/about";
import { envFrom } from "~/lib/context";
import { jsonLd, marketingMeta, organizationSchema, originFrom } from "~/lib/seo";
import { BIO_FULL, CREDENTIALS_VERIFIED, CREDENTIALS_PENDING_VERIFICATION } from "~/content/bezz";
import { Button, CoreQuote } from "~/components/ui";
import { publicPageHeaders } from "~/lib/cache.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  return {
    origin: originFrom(request, env),
    bio: BIO_FULL,
    credentials: CREDENTIALS_VERIFIED ? CREDENTIALS_PENDING_VERIFICATION : null,
  };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 600);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const origin = loaderData?.origin ?? "";
  return [
    ...marketingMeta({
      title: "About Bezz",
      description:
        "Bezz is a filmmaker, artist and breath facilitator, and the founder of BreathFLOW Practice.",
      path: "/about",
      origin,
    }),
    jsonLd(organizationSchema(origin)),
  ];
}

export default function About({ loaderData }: Route.ComponentProps) {
  const { bio, credentials } = loaderData;

  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-serif text-4xl text-[var(--color-bone)]">
        About Bezz
      </h1>

      <div className="mt-8 space-y-5">
        {bio.map((paragraph) => (
          <p
            key={paragraph.slice(0, 40)}
            className="text-[1.05rem] leading-[1.8] text-[var(--color-bone-muted)]"
          >
            {paragraph}
          </p>
        ))}
      </div>

      {credentials ? (
        <p className="mt-6 text-sm leading-relaxed text-[var(--color-bone-faint)]">
          {credentials.certification}. Has studied with{" "}
          {credentials.teachers.join(" and ")}, and facilitated at{" "}
          {credentials.venues.join(", ")}.
        </p>
      ) : null}

      <section className="mt-16 border-t border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] pt-12">
        <h2 className="font-serif text-2xl text-[var(--color-bone)]">
          Why BreathFLOW, and not just breathwork
        </h2>
        <div className="mt-5 space-y-5 leading-[1.8] text-[var(--color-bone-muted)]">
          <p>
            The word breathwork can feel clinical, or trendy, or intimidating —
            depending on who is saying it and what they are selling. It puts
            the emphasis on the technique.
          </p>
          <p>
            Flow puts the emphasis on what people actually want: to be present,
            alive, creative, regulated, and connected enough to lose themselves
            in something. It also holds both halves of the practice — the
            breath allowed to move on its own, and the breath consciously
            directed to change state.
          </p>
        </div>
      </section>

      <section className="mt-16 border-t border-[color-mix(in_oklab,var(--color-bone)_12%,transparent)] pt-12 text-center">
        <CoreQuote />
      </section>

      <div className="mt-16 text-center">
        <Button to="/welcome" size="lg">
          Begin your practice
        </Button>
      </div>
    </div>
  );
}
