import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    environmentMatchGlobs: [["tests/scrape.test.ts", "jsdom"], ["tests/detect.test.ts", "jsdom"]],
  },
});
