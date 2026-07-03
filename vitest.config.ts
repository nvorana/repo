import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["core/**/*.test.ts", "src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
