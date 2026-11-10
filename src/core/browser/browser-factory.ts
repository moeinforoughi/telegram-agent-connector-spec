import type { BrowserContext } from "playwright";
import type { BrowserLauncher } from "./browser-types";

/**
 * Keeps the Phase 0 launch options. Playwright is imported lazily so unit tests
 * and the app's startup path do not load the browser stack until Connect.
 */
export function createPlaywrightLauncher(): BrowserLauncher {
  return async ({ profileDir, proxy }): Promise<BrowserContext> => {
    const { chromium } = await import("playwright");
    return chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: null,
      acceptDownloads: false,
      timeout: 30_000,
      args: ["--no-first-run", "--no-default-browser-check"],
      ...(proxy ? { proxy } : {}),
    });
  };
}
