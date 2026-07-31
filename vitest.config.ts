import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest covers the pure logic — pricing maths, streak arithmetic, validators,
 * the spam scorer, and the content registries. Anything that needs a real D1
 * or KV is exercised against a live `wrangler dev` instead, because a mocked
 * database mostly tests the mock.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["app/**/*.test.ts", "test/**/*.test.ts"],
    globals: false,
  },
});
