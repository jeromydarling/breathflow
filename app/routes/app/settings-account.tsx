import { Form, Link, data, redirect } from "react-router";
import { safeFormData } from "~/lib/form.server";
import type { Route } from "./+types/settings-account";
import { runtimeFrom } from "~/lib/context";
import {
  clearedSessionCookie,
  destroyAllSessions,
  requireOnboardedUser,
  setPassword,
} from "~/lib/auth.server";
import { passwordProblem, verifyPassword } from "~/lib/password.server";
import { purgeOrg } from "~/lib/db.server";
import { passwordChangedEmail, sendEmail, suppress } from "~/lib/email.server";
import { Button, Card, FormError, SectionHeading } from "~/components/ui";
import { privateNoStore } from "~/lib/cache.server";

/**
 * Account, data export and deletion.
 *
 * The export excludes every password and provider identifier — see
 * NEVER_EXPORT_COLUMNS in db.server.ts. Deletion is real deletion, not a flag.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);

  return {
    email: user.email,
    isDemo: user.is_demo === 1,
    memberSince: user.created_at,
  };
}

export function headers() {
  return privateNoStore();
}

export function meta() {
  return [
    { title: "Your data · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = runtimeFrom(context);
  const user = await requireOnboardedUser(request, env);
  const form = await safeFormData(request);
  const intent = String(form.get("intent") ?? "");

  if (user.is_demo === 1) {
    return data(
      { error: "This is the shared demo account, so it can't be changed here." },
      { status: 400 },
    );
  }

  if (intent === "change-password") {
    const current = String(form.get("currentPassword") ?? "");
    const next = String(form.get("newPassword") ?? "");

    const ok = await verifyPassword(current, user.password_hash);
    if (!ok) {
      return data(
        { error: "That current password doesn't match. Worth another try?" },
        { status: 401 },
      );
    }

    const issue = passwordProblem(next);
    if (issue) return data({ error: issue }, { status: 400 });

    await setPassword(env, user.id, next);
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

    // Every device is signed out, including this one.
    return redirect("/login", {
      headers: { "Set-Cookie": clearedSessionCookie() },
    });
  }

  if (intent === "delete") {
    const confirmation = String(form.get("confirm") ?? "").trim().toLowerCase();
    if (confirmation !== "delete") {
      return data(
        { error: 'Type "delete" in the box to confirm — we want to be sure.' },
        { status: 400 },
      );
    }

    // Suppress the address first, so nothing in flight reaches a deleted user.
    await suppress(env, user.email, "unsubscribed");
    await purgeOrg(env.DB, user.org_id);

    return redirect("/?deleted=1", {
      headers: { "Set-Cookie": clearedSessionCookie() },
    });
  }

  return data({ error: "We didn't recognise that." }, { status: 400 });
}

export default function AccountSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { email, isDemo, memberSince } = loaderData;

  return (
    <div className="mx-auto max-w-lg space-y-8 pt-2">
      <header>
        <Link
          to="/settings"
          className="text-sm text-[var(--color-bone-muted)] underline underline-offset-4"
        >
          ← Settings
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-[var(--color-bone)]">
          Your data and account
        </h1>
      </header>

      {actionData && "error" in actionData ? (
        <FormError>{actionData.error}</FormError>
      ) : null}

      <Card>
        <SectionHeading>Account</SectionHeading>
        <p className="mt-2 text-[var(--color-bone)]">{email}</p>
        <p className="mt-1 text-sm text-[var(--color-bone-faint)]">
          Practising since {new Date(memberSince).toLocaleDateString()}
        </p>
      </Card>

      {!isDemo ? (
        <section>
          <SectionHeading>Change your password</SectionHeading>
          <Form method="post" className="mt-3 space-y-4">
            <input type="hidden" name="intent" value="change-password" />

            <div className="space-y-2">
              <label
                htmlFor="currentPassword"
                className="block text-sm text-[var(--color-bone-muted)]"
              >
                Current password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="newPassword"
                className="block text-sm text-[var(--color-bone-muted)]"
              >
                New password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
              />
              <p className="text-xs text-[var(--color-bone-faint)]">
                At least 10 characters. Changing it signs out every device,
                including this one.
              </p>
            </div>

            <Button type="submit" variant="ghost" className="w-full">
              Change password
            </Button>
          </Form>
        </section>
      ) : null}

      <section>
        <SectionHeading>Take your data</SectionHeading>
        <Card className="mt-3">
          <p className="text-sm leading-relaxed text-[var(--color-bone-muted)]">
            Every practice session, retention log, reflection and marker, as
            plain JSON. Passwords and payment identifiers are never included.
          </p>
          {/* A plain link, so it downloads properly and works without JS. */}
          <a
            href="/my-data.json"
            download
            className="mt-4 inline-flex items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-bone)_28%,transparent)] px-4 py-2 text-sm font-medium text-[var(--color-bone)] transition hover:bg-[color-mix(in_oklab,var(--color-bone)_10%,transparent)]"
          >
            Download my data
          </a>
        </Card>
      </section>

      {!isDemo ? (
        <section>
          <SectionHeading>Delete your account</SectionHeading>
          <Card className="mt-3 border-[color-mix(in_oklab,var(--color-copper)_45%,transparent)]">
            <p className="text-sm leading-relaxed text-[var(--color-bone-muted)]">
              This removes everything — your sessions, your Life Force Minutes,
              your reflections, your account. It happens immediately and cannot
              be undone. Consider downloading your data first.
            </p>

            <Form method="post" className="mt-4 space-y-3">
              <input type="hidden" name="intent" value="delete" />
              <div className="space-y-2">
                <label
                  htmlFor="confirm"
                  className="block text-sm text-[var(--color-bone-muted)]"
                >
                  Type <span className="text-[var(--color-bone)]">delete</span>{" "}
                  to confirm
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[color-mix(in_oklab,var(--color-bone)_18%,transparent)] bg-[color-mix(in_oklab,var(--color-bone)_6%,transparent)] px-4 py-3 text-[var(--color-bone)]"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full border border-[color-mix(in_oklab,var(--color-copper)_60%,transparent)] px-6 py-3 text-[var(--color-copper-bright)] transition hover:bg-[color-mix(in_oklab,var(--color-copper)_15%,transparent)]"
              >
                Delete my account
              </button>
            </Form>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
