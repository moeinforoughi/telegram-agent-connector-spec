import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

/** Fails loudly instead of skipping when the pinned browser is not available. */
export function browserTestPaths(): { profileDir: string; lockPath: string } {
  const executable = chromium.executablePath();
  if (!fs.existsSync(executable)) {
    throw new Error(
      `Chromium for Playwright is missing at ${executable}. ` +
        "Run `npx playwright install chromium` or set PLAYWRIGHT_BROWSERS_PATH.",
    );
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-integration-"));
  return {
    profileDir: path.join(root, "chromium-user-data"),
    lockPath: path.join(root, "profile.lock"),
  };
}
