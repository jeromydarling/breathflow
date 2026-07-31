import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // The Anthropic SDK and Stripe SDK are server-only. If a shared module is
      // ever pulled into the browser graph, alias them to an empty stub rather
      // than shipping ~200kb of Node-flavoured SDK to a user who is trying to
      // breathe. See app/lib/empty-module.ts.
      ...(process.env.VITE_CLIENT_BUILD
        ? {
            "@anthropic-ai/sdk": "/app/lib/empty-module.ts",
            stripe: "/app/lib/empty-module.ts",
          }
        : {}),
    },
  },
  build: {
    // Keep the client bundle honest — this app is opened by anxious people on
    // bad connections.
    chunkSizeWarningLimit: 700,
  },
});
