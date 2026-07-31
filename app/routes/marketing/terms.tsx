import { Link } from "react-router";
import type { Route } from "./+types/terms";
import { envFrom } from "~/lib/context";
import { marketingMeta, originFrom } from "~/lib/seo";
import { HealthDisclaimer } from "~/components/ui";
import { publicPageHeaders } from "~/lib/cache.server";

/**
 * FLAGGED FOR LEGAL REVIEW BEFORE LAUNCH.
 *
 * A plain-language statement of the actual arrangement — a useful brief for a
 * lawyer, not a substitute for one. Liability limitation, governing law,
 * arbitration and jurisdictional consumer-rights carve-outs are deliberately
 * absent rather than guessed at.
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
    title: "Terms",
    description: "The arrangement between you and BreathFLOW, in plain words.",
    path: "/terms",
    origin: loaderData?.origin ?? "",
  });
}

export default function Terms({ loaderData }: Route.ComponentProps) {
  const { supportEmail } = loaderData;

  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-serif text-4xl text-[var(--color-bone)]">Terms</h1>

      <p className="mt-6 rounded-2xl border border-[color-mix(in_oklab,var(--color-amber)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-amber)_10%,transparent)] p-5 text-sm leading-relaxed text-[var(--color-bone-muted)]">
        These terms describe the arrangement in plain words. They have not yet
        been through legal review, and they do not yet address liability
        limitation, governing law, or jurisdiction-specific consumer rights.
        That review happens before launch.
      </p>

      <div className="mt-10 space-y-10">
        <Section title="What BreathFLOW is">
          <p>
            A daily breath practice, delivered as software. It is a wellbeing
            tool, not healthcare, and not a substitute for medical or
            psychological care.
          </p>
        </Section>

        <Section title="Practising safely is your responsibility">
          <p>
            You agree to follow the{" "}
            <Link to="/safety" className="underline underline-offset-4">
              safety guidance
            </Link>
            : practise seated or lying down, never hold your breath in or near
            water or while driving, and stop if anything hurts. If you have a
            relevant medical condition, are pregnant, or are unsure, talk to a
            qualified healthcare professional before practising activating
            breath or retention.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            One person per account. Keep your password to yourself. You can
            download your data or delete your account at any time from{" "}
            <Link to="/settings/account" className="underline underline-offset-4">
              your settings
            </Link>
            .
          </p>
        </Section>

        <Section title="Membership and payment">
          <p>
            The free plan is free with no card and no time limit. A paid
            membership renews automatically at the price shown at the time you
            joined, and you can cancel any time — you keep access until the end
            of the period you already paid for. We will always tell you before
            a price changes.
          </p>
          <p>
            1:1 sessions and retreats are separate purchases and are not
            included in any membership.
          </p>
        </Section>

        <Section title="What belongs to whom">
          <p>
            The practices, guides, recordings and artwork belong to BreathFLOW
            Practice. Your reflections, session history and retention logs
            belong to you.
          </p>
        </Section>

        <Section title="Ending the arrangement">
          <p>
            You can stop at any time by deleting your account. We may close an
            account that is being used to harm other people or the service, and
            we will tell you why.
          </p>
        </Section>

        <Section title="Getting in touch">
          <p>
            <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
              {supportEmail}
            </a>
            . A person will answer.
          </p>
        </Section>
      </div>

      <HealthDisclaimer className="mt-16" />
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
