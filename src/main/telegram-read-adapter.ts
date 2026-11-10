import type { Page } from "playwright";
import { AppError } from "../shared/errors";
import {
  detectChatList,
  detectOpenChat,
  createTelegramDomProbe,
  type ChatListState,
  type ChatType,
} from "../core/telegram/chat-surface";
import { SELECTORS } from "../core/telegram/selectors/selector-map";
import { AccountActionQueue } from "./account-action-queue";

export type MessageDirection = "incoming" | "outgoing" | "unknown";

export type ChatSummary = {
  readonly id: string;
  readonly title: string;
  /** List rows do not expose a reliable peer type, so this is unknown. */
  readonly type: ChatType;
  readonly lastMessagePreview?: string;
  readonly unread: boolean;
};

export type OpenChatInfo = {
  readonly id: string | null;
  readonly title: string;
  readonly type: ChatType;
  readonly titleVisible: boolean;
};

export type MessageSummary = {
  readonly id: string;
  readonly text?: string;
  readonly direction: MessageDirection;
  readonly timestamp?: string;
  readonly sender?: string;
};

export type MessageMetadata = Omit<MessageSummary, "text">;

export type ReadMessagesResult = {
  readonly messages: MessageSummary[];
  readonly totalVisible: number;
  readonly truncated: boolean;
};

export type TelegramPageSource = (accountId: string) => Page | undefined;

export type TelegramReadAdapterOptions = {
  readonly pageSource: TelegramPageSource;
  readonly operationTimeoutMs?: number;
  readonly loadingTimeoutMs?: number;
  readonly maxChats?: number;
  readonly maxMessages?: number;
};

const DEFAULT_OPERATION_TIMEOUT = 15_000;
const DEFAULT_LOADING_TIMEOUT = 12_000;
const DEFAULT_MAX_CHATS = 20;
const DEFAULT_MAX_MESSAGES = 20;
const MAX_TEXT = 4_000;
const MAX_TITLE = 256;
const MAX_SENDER = 128;

function clampLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError("INVALID_ARGUMENT", "Invalid result limit");
  }
  return Math.min(value, maximum);
}

function bound(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function classifyMessageDirection(classes: readonly string[]): MessageDirection {
  if (classes.includes("is-out")) return "outgoing";
  if (classes.includes("is-in")) return "incoming";
  return "unknown";
}

function isoFromTimestamp(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const millis = value > 10_000_000_000 ? value : value * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Read-only Telegram helpers. Every operation is bound to one account and runs
 * through that account's serial queue. No operation opens a chat except
 * `openChat`; no write operation exists here.
 */
export class TelegramReadAdapter {
  private readonly options: TelegramReadAdapterOptions;
  private readonly queues = new Map<string, AccountActionQueue>();

  constructor(options: TelegramReadAdapterOptions) {
    this.options = options;
  }

  async listChats(accountId: string, options: { limit?: number } = {}): Promise<ChatSummary[]> {
    const limit = clampLimit(
      options.limit,
      DEFAULT_MAX_CHATS,
      this.options.maxChats ?? DEFAULT_MAX_CHATS,
    );
    return this.queue(accountId).run((page) => this.readChatRows(page, limit));
  }

  async searchChats(
    accountId: string,
    query: string,
    options: { limit?: number } = {},
  ): Promise<ChatSummary[]> {
    const text = query.trim();
    if (!text) throw new AppError("INVALID_ARGUMENT", "Search query is required");
    if (text.length > 200) throw new AppError("INVALID_ARGUMENT", "Search query is too long");

    const limit = clampLimit(
      options.limit,
      DEFAULT_MAX_CHATS,
      this.options.maxChats ?? DEFAULT_MAX_CHATS,
    );
    return this.queue(accountId).run(async (page) => {
      const input = page.locator(SELECTORS.searchInput[0] ?? ".input-search-input").first();
      if ((await input.count()) === 0) {
        throw new AppError("TELEGRAM_UI_CHANGED", "Search input was not found", {
          retryable: true,
        });
      }
      await input.fill(text);
      try {
        await page
          .locator(SELECTORS.searchResults[0] ?? ".search-super")
          .first()
          .waitFor({
            state: "visible",
            timeout: this.loadingTimeout,
          });
        return await this.readChatRows(page, limit, SELECTORS.searchResultRows[0]);
      } finally {
        await input.fill("").catch(() => undefined);
      }
    });
  }

  async getChatListState(accountId: string): Promise<ChatListState> {
    return this.queue(accountId).run((page) => detectChatList(createTelegramDomProbe(page)));
  }

  async getOpenChatInfo(accountId: string): Promise<OpenChatInfo | null> {
    return this.queue(accountId).run(async (page) => {
      const state = await detectOpenChat(createTelegramDomProbe(page));
      if (!state.open) return null;
      return this.readOpenChatInfo(page);
    });
  }

  async openChat(accountId: string, chatId: string): Promise<OpenChatInfo> {
    if (!chatId.trim()) throw new AppError("INVALID_ARGUMENT", "Chat id is required");
    return this.queue(accountId).run(async (page) => {
      const rows = page.locator(SELECTORS.chatRows[0] ?? "#chatlist-container .chatlist-chat");
      const index = await rows.evaluateAll(
        (elements, id) =>
          elements.findIndex((element) => element.getAttribute("data-peer-id") === id),
        chatId,
      );
      if (index < 0) {
        throw new AppError("CHAT_NOT_FOUND", "Chat was not found in the current list");
      }
      await rows.nth(index).click({ timeout: this.loadingTimeout });
      await page
        .locator(SELECTORS.openChat[0] ?? "#column-center .chat.active")
        .first()
        .waitFor({ state: "visible", timeout: this.loadingTimeout });
      return this.readOpenChatInfo(page);
    });
  }

  async readVisibleMessages(
    accountId: string,
    options: { limit?: number } = {},
  ): Promise<ReadMessagesResult> {
    const limit = clampLimit(options.limit, DEFAULT_MAX_MESSAGES, this.options.maxMessages ?? 50);
    return this.queue(accountId).run(async (page) => {
      await this.waitForMessages(page);
      return this.readMessages(page, limit, true);
    });
  }

  async getMessageMetadata(
    accountId: string,
    options: { limit?: number } = {},
  ): Promise<ReadMessagesResult> {
    const limit = clampLimit(options.limit, DEFAULT_MAX_MESSAGES, this.options.maxMessages ?? 50);
    return this.queue(accountId).run(async (page) => {
      await this.waitForMessages(page);
      return this.readMessages(page, limit, false);
    });
  }

  async getMessageCount(accountId: string): Promise<number> {
    return this.queue(accountId).run(async (page) => {
      await this.waitForMessages(page);
      return page.locator(SELECTORS.messageRows[0] ?? ".bubble[data-mid]").count();
    });
  }

  private get loadingTimeout(): number {
    return this.options.loadingTimeoutMs ?? DEFAULT_LOADING_TIMEOUT;
  }

  private queue(accountId: string): AccountActionQueue {
    const existing = this.queues.get(accountId);
    if (existing) return existing;
    const queue = new AccountActionQueue({
      getPage: () => this.options.pageSource(accountId),
      timeoutMs: this.options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT,
    });
    this.queues.set(accountId, queue);
    return queue;
  }

  private async readChatRows(
    page: Page,
    limit: number,
    selector: string = SELECTORS.chatRows[0] ?? "#chatlist-container .chatlist-chat",
  ): Promise<ChatSummary[]> {
    return page.locator(selector).evaluateAll(
      (elements, max) =>
        elements
          .slice(0, max)
          .map((element) => {
            const id = element.getAttribute("data-peer-id") ?? "";
            const titleElement =
              element.querySelector(".dialog-title .peer-title") ??
              element.querySelector(".row-title .peer-title") ??
              element.querySelector(".peer-title");
            const previewElement =
              element.querySelector(".dialog-subtitle") ?? element.querySelector(".row-subtitle");
            const unreadBadge = element.querySelector(".dialog-subtitle-badge-unread");
            const unread = Boolean(
              unreadBadge &&
              (unreadBadge.classList.contains("is-visible") ||
                (unreadBadge instanceof HTMLElement &&
                  (unreadBadge.offsetWidth > 0 || unreadBadge.offsetHeight > 0))),
            );
            const title = (titleElement?.textContent ?? "").trim();
            const preview = (previewElement?.textContent ?? "").trim();
            return {
              id,
              title,
              type: "unknown" as const,
              unread,
              ...(preview ? { lastMessagePreview: preview.slice(0, 256) } : {}),
            };
          })
          .filter((chat) => chat.id !== "" && chat.title !== "")
          .slice(0, max),
      limit,
    ) as Promise<ChatSummary[]>;
  }

  private async readOpenChatInfo(page: Page): Promise<OpenChatInfo> {
    const state = await detectOpenChat(createTelegramDomProbe(page));
    if (!state.open) {
      throw new AppError("TELEGRAM_UI_CHANGED", "No chat is open", { retryable: true });
    }
    const titleLocator = page
      .locator(SELECTORS.chatTitle[0] ?? "#column-center .peer-title")
      .first();
    const title =
      (await titleLocator.count()) > 0 ? await titleLocator.textContent().catch(() => null) : null;

    const peerLocator = page
      .locator(SELECTORS.chatPeerId[0] ?? "#column-center .bubble[data-peer-id]")
      .first();
    const fallbackPeerLocator = page
      .locator(SELECTORS.chatPeerId[1] ?? "#column-center .bubble[data-peer-id]")
      .first();
    const peerSource = (await peerLocator.count()) > 0 ? peerLocator : fallbackPeerLocator;
    const id =
      (await peerSource.count()) > 0
        ? await peerSource.getAttribute("data-peer-id").catch(() => null)
        : null;
    return {
      id,
      title: bound(title ?? "", MAX_TITLE),
      type: state.type,
      titleVisible: state.titleVisible,
    };
  }

  private async waitForMessages(page: Page): Promise<void> {
    const preloader = page.locator(SELECTORS.loading[0] ?? ".preloader-container").first();
    if ((await preloader.count()) > 0 && (await preloader.isVisible())) {
      try {
        await preloader.waitFor({ state: "hidden", timeout: this.loadingTimeout });
      } catch {
        throw new AppError("TIMEOUT", "Message history did not finish loading", {
          retryable: true,
        });
      }
    }

    const list = page.locator(SELECTORS.messageList[0] ?? ".bubbles").first();
    if ((await list.count()) === 0) {
      throw new AppError("TELEGRAM_UI_CHANGED", "Message list was not found", {
        retryable: true,
      });
    }
    await page.waitForTimeout(200);
  }

  private async readMessages(
    page: Page,
    limit: number,
    includeText: boolean,
  ): Promise<ReadMessagesResult> {
    const totalVisible = await page
      .locator(SELECTORS.messageRows[0] ?? ".bubble[data-mid]")
      .count();
    const messages = await page
      .locator(SELECTORS.messageRows[0] ?? ".bubble[data-mid]")
      .evaluateAll(
        (elements, input) => {
          const classesOf = (element: Element): string[] =>
            (typeof element.className === "string" ? element.className : "")
              .split(/\s+/)
              .filter(Boolean);
          return elements.slice(-input.limit).map((element) => {
            const classes = classesOf(element);
            const textElement = element.querySelector(".message");
            const senderElement = element.querySelector(".peer-title");
            return {
              id: element.getAttribute("data-mid") ?? "",
              classes,
              text: input.includeText ? (textElement?.textContent ?? "").trim() : null,
              sender: (senderElement?.textContent ?? "").trim(),
              timestamp: element.getAttribute("data-timestamp"),
            };
          });
        },
        { limit, includeText },
      );

    return {
      messages: messages
        .filter((message) => message.id !== "")
        .map((message) => {
          const direction = classifyMessageDirection(message.classes);
          const timestamp = isoFromTimestamp(message.timestamp);
          const sender = bound(message.sender, MAX_SENDER);
          return {
            id: message.id,
            direction,
            ...(message.text ? { text: bound(message.text, MAX_TEXT) } : {}),
            ...(timestamp ? { timestamp } : {}),
            ...(sender ? { sender } : {}),
          };
        }),
      totalVisible,
      truncated: totalVisible > limit,
    };
  }
}
