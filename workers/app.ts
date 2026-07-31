import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/lib/context";
import { api } from "./api";
import { runScheduled } from "./scheduled";

const handler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // JSON, webhooks and file endpoints go to Hono. Everything else is
    // server-rendered by React Router.
    if (url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return handler(request, context);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event, env, ctx));
  },
} satisfies ExportedHandler<Env>;
