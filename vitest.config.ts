import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    typecheck: {
      include: ["src/**/*.test.ts"],
    },
    environment: "node",
  },
});
