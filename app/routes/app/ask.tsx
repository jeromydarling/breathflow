import { useRef } from "react";
import { Form, Link, data, useSearchParams } from "react-router";
import type { Route } from "./+types/ask";
import { runtimeFrom } from "~/lib/context";
import { safeFormData } from "~/lib/form.server";
import { requireOnboardedUser } from "~/lib/auth.server";
import { run } from "~/lib/db.server";
import { newId } from "~/lib/ids";
import { ASK_CATEGORIES, ASK_EXPECTATION } from "~/content/bezz";
import { contactProblem, scoreSpam } from "~/lib/spam";
import { clientIp, consume, peek } from "~/lib/ratelimit.server";
import { askConfirmationEmail, askRelayEmail, sendEmail } from "~/lib/email.server";
import { upsertContact } from "~/lib/stats.server";
import { EVENTS, track } from "~/lib/analytics.server";
import { Button, Card, FormError, FormNote } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * Ask Bezz.
 *
 * Layered defences, per the house rules: a honeypot field, a client-stamped
 * timing trap, a content spam scorer, and a per-IP cap. Spam is accepted
 * silently — the sender sees the same warm thank-you — and dropped, with the
 * reason logged. Bots never learn the rule, so they never route around it.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);

  return {
    name: user.name,
    email: user.email,
    categories: ASK_CATEGORIES,
    expectation: ASK_EXPECTATION,
    // Stamped on render; compared on submit. Under two seconds is a bot.
    renderedAt: Date.now(),
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Ask Bezz · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

const THANK_YOU =
  "Thank you — your message is with us. Bezz or the team will reply as availability allows.";

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const honeypot = String(form.get("website") ?? "");
  const renderedAt = Number(form.get("renderedAt") ?? 0);

  const validCategory = (ASK_CATEGORIES as readonly string[]).includes(category)
    ? category
    : "Practice Question";

  // Ordinary validation errors are shown plainly — these are real people
  // making real mistakes, and a kind message costs nothing.
  const problem = contactProblem({ name, email, message });
  if (problem) return data({ error: problem }, { status: 400 });

  const ip = clientIp(request);
  const gate = await peek(env.KV, "contact", ip);
  if (!gate.allowed) {
    // Even a throttled sender gets the same answer.
    return data({ note: THANK_YOU });
  }
  await consume(env.KV, "contact", ip);

  const verdict = scoreSpam({
    name,
    email,
    message,
    honeypot,
    fillMs: renderedAt > 0 ? Date.now() - renderedAt : undefined,
  });

  await run(
    env.DB,
    `INSERT INTO ask_messages
       (id, org_id, user_id, name, email, category, message,
        spam_score, spam_reasons, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId("ask"),
    user.org_id,
    user.id,
    name.slice(0, 120),
    email.toLowerCase().slice(0, 254),
    validCategory,
    message.slice(0, 5000),
    verdict.score,
    verdict.reasons.join(","),
    verdict.isSpam ? "spam" : "new",
    Date.now(),
  );

  // Spam stops here. Same response, no relay, no confirmation, no contact row.
  if (verdict.isSpam) {
    console.log("ask: dropped as spam", verdict.reasons);
    return data({ note: THANK_YOU });
  }

  // The demo account never triggers outbound anything.
  if (user.is_demo === 0) {
    const confirmation = askConfirmationEmail(name, validCategory);
    const relay = askRelayEmail({ name, email, category: validCategory, message });

    ctx.waitUntil(
      Promise.all([
        sendEmail(env, {
          to: email,
          subject: confirmation.subject,
          text: confirmation.text,
          template: "ask-confirmation",
          transactional: true,
        }),
        sendEmail(env, {
          to: env.SUPPORT_EMAIL,
          subject: relay.subject,
          text: relay.text,
          template: "ask-relay",
          transactional: true,
          // So hitting reply answers the person, not the robot.
          replyTo: email,
        }),
        upsertContact(env, {
          orgId: user.org_id,
          email,
          name,
          role: roleForCategory(validCategory),
          source: "ask-bezz",
        }),
        track(env, {
          name: EVENTS.askSubmitted,
          orgId: user.org_id,
          userId: user.id,
          props: { category: validCategory },
        }),
      ]),
    );
  }

  return data({ note: THANK_YOU });
}

/** Roles stack — someone can be a practitioner and a retreat enquiry at once. */
function roleForCategory(category: string): string {
  switch (category) {
    case "1:1 Session":
      return "session-enquiry";
    case "Retreat":
      return "retreat-enquiry";
    case "Collaboration":
      return "collaboration";
    case "Technical Support":
      return "support";
    default:
      return "enquiry";
  }
}

export default function Ask({ loaderData, actionData }: Route.ComponentProps) {
  const { name, email, categories, expectation, renderedAt } = loaderData;
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("category") ?? "";
  const formRef = useRef<HTMLFormElement>(null);

  if (actionData && "note" in actionData) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-2">
        <h1 className="font-serif text-3xl text-[var(--color-bone)]">
          Message sent
        </h1>
        <FormNote>{actionData.note}</FormNote>
        <p className="text-sm leading-relaxed text-[var(--color-bone-faint)]">
          {expectation}
        </p>
        <Button to="/bezz" size="lg" className="w-full">
          Back to Bezz
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-2">
      <header>
        <Link
          to="/bezz"
          className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          ← Bezz
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-[var(--color-bone)]">
          Ask Bezz
        </h1>
      </header>

      <Form ref={formRef} method="post" className="space-y-5">
        <input type="hidden" name="renderedAt" value={renderedAt} />

        {/* Honeypot. Hidden from humans and from screen readers, visible to
            bots that fill every field they find. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="space-y-2">
          <label htmlFor="ask-name" className="block text-sm text-[var(--color-bone-muted)]">
            Your name
          </label>
          <input
            id="ask-name"
            name="name"
            required
            defaultValue={name}
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="ask-email" className="block text-sm text-[var(--color-bone-muted)]">
            Email
          </label>
          <input
            id="ask-email"
            name="email"
            type="email"
            required
            defaultValue={email}
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="ask-category" className="block text-sm text-[var(--color-bone-muted)]">
            What&rsquo;s it about?
          </label>
          <select
            id="ask-category"
            name="category"
            defaultValue={preselected || categories[0]}
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
          >
            {categories.map((category) => (
              <option key={category} value={category} className="bg-[var(--color-charcoal)]">
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="ask-message" className="block text-sm text-[var(--color-bone-muted)]">
            Your message
          </label>
          <textarea
            id="ask-message"
            name="message"
            rows={6}
            required
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
          />
        </div>

        {actionData && "error" in actionData ? (
          <FormError>{actionData.error}</FormError>
        ) : null}

        <Button type="submit" size="lg" className="w-full">
          Send
        </Button>
      </Form>

      <Card>
        <p className="text-sm leading-relaxed text-[var(--color-bone-muted)]">
          {expectation}
        </p>
      </Card>
    </div>
  );
}
