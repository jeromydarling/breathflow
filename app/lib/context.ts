import { createContext } from "react-router";

/**
 * The Cloudflare runtime handed to every loader/action.
 *
 * `ctx.waitUntil` is how every fire-and-forget side effect (email, analytics)
 * leaves the request path — a user waiting on their breath practice should
 * never wait on our mailer.
 */
export type CloudflareRuntime = {
  env: Env;
  ctx: ExecutionContext;
};

export const cloudflareContext = createContext<CloudflareRuntime>();

/** Convenience: pull the env out of a loader/action context. */
export function envFrom(context: { get: <T>(c: any) => T }): Env {
  return (context.get(cloudflareContext) as CloudflareRuntime).env;
}

export function runtimeFrom(context: {
  get: <T>(c: any) => T;
}): CloudflareRuntime {
  return context.get(cloudflareContext) as CloudflareRuntime;
}
