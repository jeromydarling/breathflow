import { Form, Link, data, redirect } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/reset";
import { envFrom, runtimeFrom } from "~/lib/context";
import {
  consumeResetToken,
  createSession,
  destroyAllSessions,
  resetTokenIsValid,
  setPassword,
} from "~/lib/auth.server";
import { passwordProblem } from "~/lib/password.server";
import { passwordChangedEmail, sendEmail } from "~/lib/email.server";
import { marketingMeta, originFrom } from "~/lib/seo";
import { Button, Field, FormError, Wordmark } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  return {
    origin: originFrom(request, env),
    valid: await resetTokenIsValid(env, params.token),
  };
}

export function headers() {
  return privateNoStore();
}

export function meta({ loaderData }: Route.MetaArgs) {
  return marketingMeta({
    title: "Choose a new password",
    path: "/reset",
    origin: loaderData?.origin ?? "",
    noIndex: true,
  });
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const form = await safeFormData(request);
  const password = String(form.get("password") ?? "");

  const issue = passwordProblem(password);
  if (issue) return data({ error: issue }, { status: 400 });

  const user = await consumeResetToken(env, params.token);
  if (!user) {
    return data(
      {
        error:
          "That link has expired or was already used. Ask for a fresh one and we'll send it right over.",
      },
      { status: 400 },
    );
  }

  await setPassword(env, user.id, password);
  // Changing a password signs out every device — including whoever might have
  // been in there without permission.
  await destroyAllSessions(env, user.id);

  const notice = passwordChangedEmail(env.APP_URL, env.SUPPORT_EMAIL);
  ctx.waitUntil(
    sendEmail(env, {
      to: user.email,
      subject: notice.subject,
      text: notice.text,
      template: "password-changed",
      transactional: true,
    }),
  );

  const { cookie } = await createSession(env, user, request);
  return redirect(user.onboarded_at ? "/home" : "/welcome", {
    headers: { "Set-Cookie": cookie },
  });
}

export default function Reset({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main className="bf-still flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-[var(--color-bone)]">
          <Wordmark className="text-sm" />
        </Link>

        {loaderData.valid ? (
          <>
            <h1 className="mt-10 text-center font-serif text-3xl text-[var(--color-bone)]">
              Choose a new password
            </h1>
            <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
              Everything else about your practice stays exactly as it was.
            </p>

            <Form method="post" className="mt-8 space-y-5">
              <Field
                label="New password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                hint="At least 10 characters."
              />

              {actionData && "error" in actionData ? (
                <FormError>{actionData.error}</FormError>
              ) : null}

              <Button type="submit" size="lg" className="w-full">
                Save and sign in
              </Button>
            </Form>
          </>
        ) : (
          <>
            <h1 className="mt-10 text-center font-serif text-3xl text-[var(--color-bone)]">
              That link has expired
            </h1>
            <p className="mt-3 text-center text-sm text-[var(--color-bone-muted)]">
              Reset links work once and last an hour. Ask for a fresh one and
              we&rsquo;ll send it straight over.
            </p>
            <Button to="/forgot" size="lg" className="mt-8 w-full">
              Send a new link
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
