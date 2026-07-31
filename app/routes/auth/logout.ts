import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { envFrom } from "~/lib/context";
import {
  clearedSessionCookie,
  destroySession,
  readSessionToken,
} from "~/lib/auth.server";

/** POST-only, so a prefetched link or an image tag can never sign you out. */
export async function action({ request, context }: Route.ActionArgs) {
  const env = envFrom(context);
  const token = readSessionToken(request);
  if (token) await destroySession(env, token);
  return redirect("/", { headers: { "Set-Cookie": clearedSessionCookie() } });
}

export async function loader() {
  return redirect("/");
}
