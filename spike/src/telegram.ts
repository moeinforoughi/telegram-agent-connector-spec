import type { Page } from "playwright";

/** Central selector layer. Telegram Web DOM is not a stable contract. */
export const SELECTORS = {
  authPage: ["#auth-pages", ".auth-pages", ".auth-pages-wrapper", ".page-auth"],
  qr: [
    "canvas",
    ".qr-container",
    ".auth-qr",
    "[data-testid='qr-canvas']",
    ".qr-code",
  ],
  chatList: [
    "#column-left",
    ".chat-list",
    ".chatlist",
    "#chatlist-container",
    ".chat-list-container",
    "[data-testid='chat-list']",
  ],
  chatItems: [
    "#chatlist-container .chatlist-chat",
    "#chatlist-container li",
    ".chat-list .chat-item",
    ".chatlist-chat",
    "a.chat-item",
    "[data-peer-id]",
  ],
} as const;

export type LoginState = "LOGIN_REQUIRED" | "CONNECTED" | "UNKNOWN";
export type Detection = { state: LoginState; evidence: string[] };
export type CountResult = { selector: string | null; count: number };

async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).first().isVisible({ timeout: 1_500 });
  } catch {
    return false;
  }
}

export async function detectLoginState(page: Page): Promise<Detection> {
  const evidence: string[] = [];

  for (const selector of SELECTORS.chatList) {
    if (await isVisible(page, selector)) evidence.push(`visible:${selector}`);
  }
  if (evidence.length > 0) return { state: "CONNECTED", evidence };

  for (const selector of SELECTORS.authPage) {
    if (await isVisible(page, selector)) evidence.push(`visible:${selector}`);
  }
  for (const selector of SELECTORS.qr) {
    if (await isVisible(page, selector)) evidence.push(`visible:${selector}`);
  }
  if (evidence.length > 0) return { state: "LOGIN_REQUIRED", evidence };

  return { state: "UNKNOWN", evidence };
}

/** Returns the first selector that matches, with its visible item count. */
export async function countChatItems(page: Page): Promise<CountResult> {
  for (const selector of SELECTORS.chatItems) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) return { selector, count };
    } catch {
      // Selector unsupported on this Telegram Web variant; try the next one.
    }
  }
  return { selector: null, count: 0 };
}

export async function pageFacts(page: Page): Promise<{
  url: string;
  titleIsTelegram: boolean;
}> {
  const title = await page.title().catch(() => "");
  return { url: page.url(), titleIsTelegram: title.includes("Telegram") };
}
