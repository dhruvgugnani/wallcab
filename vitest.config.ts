import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/features/**/*.ts", "src/server/**/*.ts", "worker/src/**/*.ts"],
    },
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
