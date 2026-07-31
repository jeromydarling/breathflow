import { Form, Link, data, redirect } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/signup";
import { envFrom, runtimeFrom } from "~/lib/context";
import {
  createSession,
  createUser,
  findUserByEmail,
  getUser,
  looksLikeEmail,
  normalizeEmail,
} from "~/lib/auth.server";
import { passwordProblem } from "~/lib/password.server";
import { clientIp, consume, peek } from "~/lib/ratelimit.server";
import { EVENTS, track } from "~/lib/analytics.server";
import { sendEmail, welcomeEmail } from "~/lib/email.server";
import { upsertContact } from "~/lib/stats.server";
import { marketingMeta, originFrom } from "~/lib/seo";
import { Button, Field, FormError, HealthDisclaimer, Wordmark } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await getUser(request, env);
  if (user) throw redirect(user.onboarded_at ? "/home" : "/welcome");
  return { origin: originFrom(request, env) };
}

export function headers() {
  return privateNoStore();
}

export function meta({ loaderData }: Route.MetaArgs) {
  return marketingMeta({
    title: "Create your practice",
    description: "Create a free BreathFLOW account and begin your first breath.",
    path: "/signup",
    origin: loaderData?.origin ?? "",
    noIndex: true,
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const form = await safeFormData(request);

  const name = String(form.get("name") ?? "").trim();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const timezone = String(form.get("timezone") ?? "UTC");

  if (!looksLikeEmail(email)) {
    return data(
      { error: "We need a real email address — that's how you get back in." },
      { status: 400 },
    );
  }

  const passwordIssue = passwordProblem(password);
  if (passwordIssue) return data({ error: passwordIssue }, { status: 400 });

  const ip = clientIp(request);
  const gate = await peek(env.KV, "signup", ip);
  if (!gate.allowed) {
    return data(
      { error: "That's a lot of accounts from one place. Try again a little later." },
      { status: 429 },
    );
  }

  const existing = await findUserByEmail(env, email);
  if (existing) {
    return data(
      {
        error:
          "There's already a practice under that address. Sign in instead, or reset the password.",
      },
      { status: 409 },
    );
  }

  await consume(env.KV, "signup", ip);
  const user = await createUser(env, { email, password, name, timezone });
  const { cookie } = await createSession(env, user, request);

  const welcome = welcomeEmail(name, env.APP_URL);
  ctx.waitUntil(
    Promise.all([
      // Immediate welcome. Fire-and-forget — nobody waits on our mailer.
      sendEmail(env, {
        to: email,
        subject: welcome.subject,
        text: welcome.text,
        template: "welcome",
        transactional: true,
      }),
      // Every inbound action finds-or-creates the contact automatically.
      upsertContact(env, {
        orgId: user.org_id,
        email,
        name,
        role: "practitioner",
        source: "signup",
      }),
      track(env, {
        name: EVENTS.signup,
        orgId: user.org_id,
        userId: user.id,
      }),
    ]),
  );

  return redirect("/welcome/first-breath", {
    headers: { "Set-Cookie": cookie },
  });
}

export default function Signup({ actionData }: Route.ComponentProps) {
  return (
    <main className="bf-still flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-[var(--color-bone)]">
          <Wordmark className="text-sm" />
        </Link>

        <h1 className="mt-10 text-center font-serif text-3xl text-[var(--color-bone)]">
          Create your practice
        </h1>
        <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
          Free, and free to stay. No card.
        </p>

        <Form method="post" className="mt-8 space-y-5">
          {/*
            The browser knows the timezone; the server does not. Streaks are
            computed against the user's own midnight, so this matters.
          */}
          <TimezoneField />

          <Field
            label="What should we call you?"
            name="name"
            autoComplete="given-name"
            placeholder="First name is plenty"
          />
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            hint="At least 10 characters. A short phrase works beautifully."
          />

          {actionData && "error" in actionData ? (
            <FormError>{actionData.error}</FormError>
          ) : null}

          <Button type="submit" size="lg" className="w-full">
            Begin
          </Button>
        </Form>

        <p className="mt-6 text-center text-xs text-[var(--color-bone-faint)]">
          By creating a practice you agree to our{" "}
          <Link to="/terms" className="underline underline-offset-4">
            terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>

        <p className="mt-6 text-center text-sm text-[var(--color-bone-faint)]">
          Already practising?{" "}
          <Link to="/login" className="text-[var(--color-bone)] underline underline-offset-4">
            Sign in
          </Link>
        </p>

        <HealthDisclaimer className="mt-10" />
      </div>
    </main>
  );
}

/**
 * Posts the browser's IANA timezone. Rendered as a plain hidden input with a
 * safe default so it still works with JavaScript disabled — the value is just
 * corrected on the client before submit.
 */
function TimezoneField() {
  return (
    <input
      type="hidden"
      name="timezone"
      defaultValue="UTC"
      ref={(node) => {
        if (!node) return;
        try {
          node.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        } catch {
          node.value = "UTC";
        }
      }}
    />
  );
}
