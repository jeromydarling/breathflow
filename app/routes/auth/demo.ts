import { redirect } from "react-router";
import type { Route } from "./+types/demo";
import { envFrom } from "~/lib/context";
import { createSession } from "~/lib/auth.server";
import { ensureDemoAccount } from "~/lib/demo.server";

/**
 * Auto-login to the seeded demo.
 *
 * `ensureDemoAccount` self-heals first, so even if the nightly reset failed or
 * someone emptied it, the visitor lands in a populated account. The demo is
 * the best sales tool we have — it must never be broken or empty.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envFrom(context);
  const demo = await ensureDemoAccount(env);
  const { cookie } = await createSession(env, demo, request);
  return redirect("/home", { headers: { "Set-Cookie": cookie } });
}
