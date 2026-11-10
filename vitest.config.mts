import { defineConfig } from "vitest/config";
import fs from "node:fs";

// Local Chromium from the Phase 0 download; never used by packaged product code.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync("spike/.browsers")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers";
}

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
