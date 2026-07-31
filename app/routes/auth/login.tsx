import { Form, Link, data, redirect } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/login";
import { envFrom, runtimeFrom } from "~/lib/context";
import {
  createSession,
  getUser,
  normalizeEmail,
  touchLastSeen,
  verifyCredentials,
} from "~/lib/auth.server";
import { clientIp, consume, peek, reset } from "~/lib/ratelimit.server";
import { EVENTS, track } from "~/lib/analytics.server";
import { marketingMeta, originFrom } from "~/lib/seo";
import { Button, Field, FormError, Wordmark } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const user = await getUser(request, env);
  if (user) throw redirect(user.onboarded_at ? "/home" : "/welcome");

  // Resolve `next` on the server so the rendered form matches on hydration,
  // and so an open-redirect can't be smuggled in through the query string.
  const raw = new URL(request.url).searchParams.get("next") ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/home";

  return { origin: originFrom(request, env), next };
}

export function headers() {
  return privateNoStore();
}

export function meta({ loaderData }: Route.MetaArgs) {
  return marketingMeta({
    title: "Sign in",
    description: "Sign in to your BreathFLOW practice.",
    path: "/login",
    origin: loaderData?.origin ?? "",
    noIndex: true,
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const form = await safeFormData(request);
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/home");

  if (!email || !password) {
    return data(
      { error: "We need an email address and a password — that's all." },
      { status: 400 },
    );
  }

  // Rate limit per IP+email. Only failures are counted, so a working password
  // is never throttled. A KV outage fails open by design.
  const key = `${clientIp(request)}:${email}`;
  const gate = await peek(env.KV, "login", key);
  if (!gate.allowed) {
    return data(
      {
        error: `That's a lot of attempts in a short time. Try again in about ${Math.ceil(
          gate.retryAfter / 60,
        )} minutes, or reset your password.`,
      },
      { status: 429 },
    );
  }

  const user = await verifyCredentials(env, email, password);
  if (!user) {
    await consume(env.KV, "login", key);
    // Deliberately identical whether the address exists or the password is
    // wrong — no account enumeration.
    return data(
      { error: "That email and password don't match. Worth another try?" },
      { status: 401 },
    );
  }

  await reset(env.KV, "login", key);
  const { cookie } = await createSession(env, user, request);

  ctx.waitUntil(
    Promise.all([
      touchLastSeen(env, user.id),
      track(env, {
        name: EVENTS.login,
        orgId: user.org_id,
        userId: user.id,
      }),
    ]),
  );

  const destination = user.onboarded_at
    ? next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/home"
    : "/welcome";

  return redirect(destination, { headers: { "Set-Cookie": cookie } });
}

export default function Login({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <main className="bf-still flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-[var(--color-bone)]">
          <Wordmark className="text-sm" />
        </Link>

        <h1 className="mt-10 text-center font-serif text-3xl text-[var(--color-bone)]">
          Welcome back
        </h1>
        <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
          Your practice is where you left it.
        </p>

        <Form method="post" className="mt-8 space-y-5">
          <input type="hidden" name="next" value={loaderData.next} />
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
            autoComplete="current-password"
          />

          {actionData && "error" in actionData ? (
            <FormError>{actionData.error}</FormError>
          ) : null}

          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>
        </Form>

        <div className="mt-8 space-y-3 text-center text-sm">
          <p>
            <Link
              to="/forgot"
              className="text-[var(--color-bone-muted)] underline underline-offset-4 hover:text-[var(--color-bone)]"
            >
              Forgot your password?
            </Link>
          </p>
          <p className="text-[var(--color-bone-faint)]">
            New here?{" "}
            <Link
              to="/welcome"
              className="text-[var(--color-bone)] underline underline-offset-4"
            >
              Begin your practice
            </Link>
          </p>
          <p className="text-[var(--color-bone-faint)]">
            Or{" "}
            <Link
              to="/demo"
              className="underline underline-offset-4 hover:text-[var(--color-bone)]"
            >
              look around the demo
            </Link>{" "}
            — no account needed.
          </p>
        </div>
      </div>
    </main>
  );
}
