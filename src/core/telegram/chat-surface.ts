import type { Page } from "playwright";
import type { TelegramChatType } from "../../shared/telegram";
import { SELECTORS } from "./selectors/selector-map";
import type { PageProbe } from "./telegram-types";

/** Page probe with attribute access for peer/message type inspection. */
export type TelegramDomProbe = PageProbe & {
  attribute(selector: string, name: string): Promise<string | null>;
};

export type MainSurface = "ready" | "login_required" | "loading" | "ui_changed";

export type ChatListState =
  | { readonly state: "ready"; readonly itemCount: number }
  | { readonly state: "empty" }
  | { readonly state: "loading" }
  | { readonly state: "ui_changed" };

export type ChatType = TelegramChatType;

export type OpenChatState =
  | { readonly open: false }
  | {
      readonly open: true;
      readonly type: ChatType;
      readonly titleVisible: boolean;
    };

export type MessageStats = {
  readonly total: number;
  readonly incoming: number;
  readonly outgoing: number;
  readonly channelPosts: number;
};

export type SearchState = "idle" | "active" | "loading" | "no_results" | "unknown";

async function anyVisible(
  probe: TelegramDomProbe,
  selectors: readonly string[],
): Promise<string | null> {
  for (const selector of selectors) {
    if (await probe.isVisible(selector)) return selector;
  }
  return null;
}

async function countAny(probe: TelegramDomProbe, selectors: readonly string[]): Promise<number> {
  for (const selector of selectors) {
    const count = await probe.count(selector);
    if (count > 0) return count;
  }
  return 0;
}

function mapChatType(value: string | null): ChatType {
  if (value === "channel" || value === "group" || value === "chat") {
    return value === "chat" ? "user" : value;
  }
  return "unknown";
}

/** Distinguishes the main app shell from the login/QR page and an unknown UI. */
export async function detectMainSurface(probe: TelegramDomProbe): Promise<MainSurface> {
  if (await anyVisible(probe, SELECTORS.authPage)) return "login_required";
  const shell = await anyVisible(probe, SELECTORS.mainShell);
  if (shell) return "ready";
  if (await anyVisible(probe, SELECTORS.loading)) return "loading";
  return "ui_changed";
}

export async function detectChatList(probe: TelegramDomProbe): Promise<ChatListState> {
  if (await anyVisible(probe, SELECTORS.authPage)) return { state: "ui_changed" };
  if (!(await anyVisible(probe, SELECTORS.mainShell))) return { state: "ui_changed" };

  // A loading preloader may belong to the message area, so rows win here.
  const itemCount = await countAny(probe, SELECTORS.chatRows);
  if (itemCount > 0) return { state: "ready", itemCount };
  if (await anyVisible(probe, SELECTORS.chatListLoading)) return { state: "loading" };
  if (await anyVisible(probe, SELECTORS.emptyState)) return { state: "empty" };
  return { state: "empty" };
}

export async function detectOpenChat(probe: TelegramDomProbe): Promise<OpenChatState> {
  const selector = await anyVisible(probe, SELECTORS.openChat);
  if (!selector) return { open: false };

  const dataType = await probe.attribute(selector, "data-type");
  const channelPosts = await countAny(probe, SELECTORS.channelPosts);
  const type = dataType === null && channelPosts > 0 ? "channel" : mapChatType(dataType);
  return {
    open: true,
    type: channelPosts > 0 && type === "unknown" ? "channel" : type,
    titleVisible: (await anyVisible(probe, SELECTORS.chatTitle)) !== null,
  };
}

export async function detectChannel(probe: TelegramDomProbe): Promise<boolean> {
  const chat = await detectOpenChat(probe);
  if (!chat.open) return false;
  if (chat.type === "channel") return true;
  return (await countAny(probe, SELECTORS.channelPosts)) > 0;
}

/** Counts messages without reading any text. */
export async function readMessageStats(probe: TelegramDomProbe): Promise<MessageStats> {
  return {
    total: await countAny(probe, SELECTORS.messageRows),
    incoming: await countAny(probe, SELECTORS.incomingMessages),
    outgoing: await countAny(probe, SELECTORS.outgoingMessages),
    channelPosts: await countAny(probe, SELECTORS.channelPosts),
  };
}

export async function detectSearchState(probe: TelegramDomProbe): Promise<SearchState> {
  const input = await anyVisible(probe, SELECTORS.searchInput);
  if (!input) return "unknown";
  if (await anyVisible(probe, SELECTORS.searchNoResults)) return "no_results";
  if (await anyVisible(probe, SELECTORS.loading)) return "loading";
  if (await anyVisible(probe, SELECTORS.searchResults)) return "active";
  return "idle";
}

/** Playwright-backed probe used by the adapter. */
export function createTelegramDomProbe(page: Page): TelegramDomProbe {
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
    attribute: async (selector, name) => {
      try {
        return await page.locator(selector).first().getAttribute(name);
      } catch {
        return null;
      }
    },
  };
}
