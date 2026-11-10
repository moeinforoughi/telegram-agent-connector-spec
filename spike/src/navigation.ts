import type { Page } from "playwright";
import { config } from "./config.js";

export async function openTelegram(page: Page): Promise<string> {
  await page.goto(config.telegramUrl, {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs,
  });
  await page.waitForTimeout(5_000);
  return page.url();
}
