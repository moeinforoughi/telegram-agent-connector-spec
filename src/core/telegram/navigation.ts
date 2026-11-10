import type { Page } from "playwright";
import { AppError } from "../../shared/errors";

export const TELEGRAM_WEB_URL = "https://web.telegram.org/k/";

export function isTelegramWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "web.telegram.org" &&
      (parsed.pathname === "/k" || parsed.pathname === "/k/" || parsed.pathname.startsWith("/k/"))
    );
  } catch {
    return false;
  }
}

export async function openTelegram(page: Page): Promise<string> {
  try {
    await page.goto(TELEGRAM_WEB_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (error) {
    throw new AppError("NETWORK_ERROR", "Could not open Telegram Web", {
      retryable: true,
      cause: error,
    });
  }

  const finalUrl = page.url();
  if (!isTelegramWebUrl(finalUrl)) {
    throw new AppError("TELEGRAM_UI_CHANGED", "Telegram Web opened an unexpected page", {
      retryable: true,
    });
  }
  return finalUrl;
}
