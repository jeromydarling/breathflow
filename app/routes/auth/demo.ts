import { redirect } from "react-router";
import type { Route } from "./+types/demo";
import { envFrom } from "~/lib/context";
import { createSession } from "~/lib/auth.server";
import { ensureDemoAccount } from "~/lib/demo.server";
import { recordError } from "~/lib/errors.server";

/**
 * Auto-login to the seeded demo.
 *
 * `ensureDemoAccount` self-heals first, so even if the nightly reset failed or
 * someone emptied it, the visitor lands in a populated account.
 *
 * If seeding genuinely cannot complete, this must not hand a stranger a raw
 * 500 — the demo is the first thing many people will ever see. We record why
 * it failed and send them somewhere useful instead.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);

  try {
    const demo = await ensureDemoAccount(env);
    const { cookie } = await createSession(env, demo, request);
    return redirect("/home", { headers: { "Set-Cookie": cookie } });
  } catch (error) {
    await recordError(env, "demo:ensure", error);
    // The marketing site still works, and so does signing up for real.
    return redirect("/?demo=unavailable");
  }
}
