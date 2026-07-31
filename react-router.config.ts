import type { Config } from "@react-router/dev/config";

export default {
  // Server-render everything. Public pages must be crawlable and AI-readable.
  ssr: true,
} satisfies Config;
