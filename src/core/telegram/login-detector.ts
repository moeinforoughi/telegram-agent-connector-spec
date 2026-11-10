import type { Page } from "playwright";
import { SELECTORS } from "./selectors/selector-map";
import type { LoginDetection, PageProbe } from "./telegram-types";

export type { PageProbe };

async function firstVisible(
  probe: PageProbe,
  selectors: readonly string[],
): Promise<string | null> {
  for (const selector of selectors) {
    if (await probe.isVisible(selector)) return selector;
  }
  return null;
}

async function chatItemEvidence(probe: PageProbe): Promise<string | undefined> {
  for (const selector of SELECTORS.chatItems) {
    const count = await probe.count(selector);
    if (count > 0) return `chatItems:${selector}:${count}`;
  }
  return undefined;
}

/**
 * Visibility, not DOM presence, decides the state. CONNECTED requires the chat
 * list to be visible while no auth/QR UI is visible.
 */
export async function detectLoginState(probe: PageProbe): Promise<LoginDetection> {
  const chatList = await firstVisible(probe, SELECTORS.chatList);
  const authPage = await firstVisible(probe, SELECTORS.authPage);
  const qr = await firstVisible(probe, SELECTORS.qr);
  const loginUi = authPage ?? qr;

  const evidence: string[] = [];
  if (chatList) evidence.push(`visible:${chatList}`);
  if (authPage) evidence.push(`visible:${authPage}`);
  if (qr) evidence.push(`visible:${qr}`);

  if (chatList && !loginUi) {
    const items = await chatItemEvidence(probe);
    if (items) evidence.push(items);
    return { state: "CONNECTED", evidence };
  }
  if (chatList && loginUi) return { state: "AUTHENTICATING", evidence };
  if (loginUi) return { state: "LOGIN_REQUIRED", evidence };
  return { state: "UNKNOWN", evidence };
}

export function createPlaywrightProbe(page: Page): PageProbe {
  return {
    url: () => page.url(),
    isVisible: async (selector) => {
      try {
        return await page.locator(selector).first().isVisible();
      } catch {
        return false;
      }
    },
    count: async (selector) => {
      try {
        return await page.locator(selector).count();
      } catch {
        return 0;
      }
    },
  };
}
