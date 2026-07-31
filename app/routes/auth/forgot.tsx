import { Form, Link, data } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/forgot";
import { envFrom, runtimeFrom } from "~/lib/context";
import {
  findUserByEmail,
  issueResetToken,
  normalizeEmail,
} from "~/lib/auth.server";
import { clientIp, consume, peek } from "~/lib/ratelimit.server";
import { passwordResetEmail, sendEmail } from "~/lib/email.server";
import { appUrl, marketingMeta, originFrom } from "~/lib/seo";
import { Button, Field, FormError, FormNote, Wordmark } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  return { origin: originFrom(request, envFrom(context)) };
}

export function headers() {
  return privateNoStore();
}

export function meta({ loaderData }: Route.MetaArgs) {
  return marketingMeta({
    title: "Reset your password",
    path: "/forgot",
    origin: loaderData?.origin ?? "",
    noIndex: true,
  });
}

/**
 * The response is identical whether or not the address exists. That is the
 * whole point: no account enumeration, ever.
 */
const SAME_ANSWER =
  "If there's a practice under that address, a reset link is on its way. It works once and expires in an hour.";

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const form = await safeFormData(request);
  const email = normalizeEmail(String(form.get("email") ?? ""));

  if (!email) {
    return data(
      { error: "We need the email address you practise under." },
      { status: 400 },
    );
  }

  const ipGate = await peek(env.KV, "passwordReset", clientIp(request));
  const emailGate = await peek(env.KV, "passwordReset", email);
  if (!ipGate.allowed || !emailGate.allowed) {
    // Still the same answer — a throttled attacker learns nothing either.
    return data({ note: SAME_ANSWER });
  }

  await Promise.all([
    consume(env.KV, "passwordReset", clientIp(request)),
    consume(env.KV, "passwordReset", email),
  ]);

  const user = await findUserByEmail(env, email);
  if (user && user.is_demo === 0) {
    const token = await issueResetToken(env, user.id);
    const message = passwordResetEmail(`${appUrl(env, request)}/reset/${token}`);
    ctx.waitUntil(
      sendEmail(env, {
        to: email,
        subject: message.subject,
        text: message.text,
        template: "password-reset",
        transactional: true,
      }),
    );
  }

  return data({ note: SAME_ANSWER });
}

export default function Forgot({ actionData }: Route.ComponentProps) {
  return (
    <main className="bf-still flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-[var(--color-bone)]">
          <Wordmark className="text-sm" />
        </Link>

        <h1 className="mt-10 text-center font-serif text-3xl text-[var(--color-bone)]">
          Let&rsquo;s get you back in
        </h1>
        <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
          Tell us the address you practise under and we&rsquo;ll send a link.
        </p>

        <Form method="post" className="mt-8 space-y-5">
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
          />

          {actionData && "error" in actionData ? (
            <FormError>{actionData.error}</FormError>
          ) : null}
          {actionData && "note" in actionData ? (
            <FormNote>{actionData.note}</FormNote>
          ) : null}

          <Button type="submit" size="lg" className="w-full">
            Send the link
          </Button>
        </Form>

        <p className="mt-8 text-center text-sm text-[var(--color-bone-faint)]">
          <Link to="/login" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
