import { Link } from "react-router";
import type { Route } from "./+types/privacy";
import { envFrom } from "~/lib/context";
import { marketingMeta, originFrom } from "~/lib/seo";
import { publicPageHeaders } from "~/lib/cache.server";

/**
 * FLAGGED FOR LEGAL REVIEW BEFORE LAUNCH.
 *
 * This describes what the software actually does today, which is the right
 * starting point for a lawyer — but it is not a reviewed privacy policy and
 * makes no attempt at GDPR/CCPA-specific wording, jurisdictional carve-outs,
 * or a data-processing addendum. Do not launch without a qualified read.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  return {
    origin: originFrom(request, env),
    supportEmail: env.SUPPORT_EMAIL,
  };
}

export function headers({ parentHeaders }: Route.HeadersArgs) {
  return publicPageHeaders(parentHeaders, 600);
}

export function meta({ loaderData }: Route.MetaArgs) {
  return marketingMeta({
    title: "Privacy",
    description: "What BreathFLOW stores, why, and how to take it back.",
    path: "/privacy",
    origin: loaderData?.origin ?? "",
  });
}

export default function Privacy({ loaderData }: Route.ComponentProps) {
  const { supportEmail } = loaderData;

  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-serif text-4xl text-[var(--color-bone)]">Privacy</h1>

      <p className="mt-6 rounded-2xl border border-[color-mix(in_oklab,var(--color-amber)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-amber)_10%,transparent)] p-5 text-sm leading-relaxed text-[var(--color-bone-muted)]">
        This page describes exactly what the software does today. It has not
        yet been through legal review, and it is not tailored to any specific
        jurisdiction. That review happens before launch.
      </p>

      <div className="mt-10 space-y-10">
        <Section title="What we store">
          <List
            items={[
              "Your email address and the name you chose to give us.",
              "A one-way hash of your password. We cannot read your password, and it is never included in a data export.",
              "Your practice sessions: which practice, how long, when, and how you said you felt afterwards.",
              "Your breath-retention logs.",
              "Any reflections you write. These are private to your account and are never shown on a share card.",
              "Your settings: timezone, reminder time, intentions, reduced-motion preference.",
            ]}
          />
        </Section>

        <Section title="What we don't store">
          <List
            items={[
              "Health records, diagnoses, or anything you have not typed in yourself.",
              "Audio or video of you. Nothing in BreathFLOW listens to you.",
              "Your card details. If you subscribe, Stripe handles payment and we only keep an identifier to know your membership status.",
              "Location beyond the timezone you set.",
            ]}
          />
        </Section>

        <Section title="Analytics">
          <p>
            We record product events — a practice started, a session completed,
            a share card opened — in our own database, not a third-party
            analytics service. Event records include which practice and how
            long, and never the contents of a reflection.
          </p>
        </Section>

        <Section title="Email">
          <p>
            We send you account emails (welcome, password reset, a note when
            your password changes) and, if you turn them on, at most one
            practice reminder a day. Every non-essential email carries a
            one-click unsubscribe, and unsubscribing is immediate.
          </p>
        </Section>

        <Section title="Taking your data, and deleting it">
          <p>
            You can download everything as JSON, and delete your account
            entirely, from{" "}
            <Link to="/settings/account" className="underline underline-offset-4">
              your account settings
            </Link>
            . Deletion is real deletion — the rows are removed, not flagged —
            and it cannot be undone.
          </p>
        </Section>

        <Section title="Getting in touch">
          <p>
            Write to{" "}
            <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
              {supportEmail}
            </a>{" "}
            with any question about your data, and a person will answer.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-[var(--color-bone)]">{title}</h2>
      <div className="mt-4 space-y-3 leading-[1.8] text-[var(--color-bone-muted)]">
        {children}
      </div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="text-[var(--color-amber-bright)]">
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
