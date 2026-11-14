import type { Page } from "playwright";
import { AppError } from "../shared/errors";
import type { PreparedMessage } from "../shared/messaging";
import type { AgentChat, AgentMessage, TelegramMessageDirection } from "../shared/telegram";
import {
  detectChatList,
  detectOpenChat,
  detectMainSurface,
  createTelegramDomProbe,
  type ChatListState,
  type ChatType,
} from "../core/telegram/chat-surface";
import { SELECTORS } from "../core/telegram/selectors/selector-map";
import { checkUiHealth, type UiHealth } from "../core/telegram/ui-map";
import { AccountActionQueue } from "./account-action-queue";
import { validatePeerId, validateMessageId } from "./message-operations";
import { activePeer, replyTarget, submitThroughComposer } from "./telegram-message-composer";

export type MessageDirection = TelegramMessageDirection;

/** Agent-facing list row: compact and bounded, never raw DOM. */
export type ChatSummary = AgentChat;

export type OpenChatInfo = {
  readonly id: string | null;
  readonly title: string;
  readonly type: ChatType;
  readonly titleVisible: boolean;
};

export type MessageSummary = AgentMessage;

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
 * through that account's serial queue. `openChat` and `readChatMessages` are the
 * only operations that open a chat; no write operation exists here.
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
    return this.queue(accountId).run(async (page) => {
      await this.requireMain(page);
      const container = page.locator(SELECTORS.chatListContainer.join(", "));
      if ((await container.count()) === 0) {
        throw new AppError("TELEGRAM_UI_CHANGED", "Chat list was not found", { retryable: true });
      }
      return this.readChatRows(page, limit);
    });
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
      await this.requireMain(page);
      const input = page.locator(SELECTORS.searchInput[0] ?? ".input-search-input").first();
      if (!(await input.isVisible())) {
        throw new AppError("TELEGRAM_UI_CHANGED", "Search input was not found", {
          retryable: true,
        });
      }
      if (await input.inputValue({ timeout: this.loadingTimeout })) {
        throw new AppError("INVALID_ARGUMENT", "Clear the active Telegram search before retrying");
      }
      const outcome = page.locator(SELECTORS.searchOutcome).first();
      if (await outcome.isVisible()) {
        throw new AppError("TELEGRAM_UI_CHANGED", "Previous search results are still visible", {
          retryable: true,
        });
      }
      try {
        await input.fill(text, { timeout: this.loadingTimeout });
        await outcome
          .waitFor({
            state: "visible",
            timeout: this.loadingTimeout,
          })
          .catch(() => {
            throw new AppError("TELEGRAM_UI_CHANGED", "Search results could not be verified", {
              retryable: true,
            });
          });
        return await this.readChatRows(page, limit, `${SELECTORS.searchResultRows[0]}:visible`);
      } finally {
        await input.fill("", { timeout: this.loadingTimeout }).catch(() => undefined);
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
    return this.queue(accountId).run((page) => this.openChatPage(page, chatId));
  }

  /**
   * Opens `chatId` only when it is not already the open chat, then reads its
   * messages in the same queued operation so no other operation can swap the
   * chat in between. Opening may mark the chat read; `opened` says so.
   */
  async readChatMessages(
    accountId: string,
    chatId: string,
    options: { limit?: number; includeText?: boolean } = {},
  ): Promise<ReadMessagesResult & { readonly opened: boolean }> {
    const id = chatId.trim();
    if (!id) throw new AppError("INVALID_ARGUMENT", "Chat id is required");
    const limit = clampLimit(options.limit, DEFAULT_MAX_MESSAGES, this.options.maxMessages ?? 50);
    return this.queue(accountId).run(async (page) => {
      await this.requireMain(page);
      const peer = page.locator(SELECTORS.activeChat).locator(SELECTORS.activeChatPeer);
      const opened =
        (await peer.count()) !== 1 ||
        (await peer.getAttribute("data-peer-id", { timeout: this.loadingTimeout })) !== id;
      if (opened) {
        await this.openChatPage(page, id);
      }
      await this.waitForMessages(page);
      const result = await this.readMessages(page, limit, options.includeText ?? true, id);
      return { opened, ...result };
    });
  }

  /** Light UI Map health check for the audited routes only. */
  async getUiHealth(accountId: string): Promise<UiHealth> {
    return this.queue(accountId).run((page) => checkUiHealth(createTelegramDomProbe(page)));
  }

  async inspectReply(accountId: string, chatId: string, messageId: string) {
    validatePeerId(chatId);
    validateMessageId(messageId);
    return this.queue(accountId).run(async (page) => {
      await this.requireMain(page);
      const chat = activePeer(page, chatId);
      if ((await chat.count()) !== 1) {
        throw new AppError(
          "CHAT_NOT_FOUND",
          "Open the target chat in Telegram before preparing a reply",
        );
      }
      const { text } = await replyTarget(chat, messageId, this.loadingTimeout);
      const info = await this.readOpenChatInfo(page);
      if (info.id !== chatId || !info.titleVisible || !info.title) {
        throw new AppError("TELEGRAM_UI_CHANGED", "Reply destination could not be verified");
      }
      return {
        recipient: { id: chatId, title: info.title, type: info.type },
        targetPreview: text.slice(0, 240),
      };
    });
  }

  async submitMessage(operation: PreparedMessage, session?: object): Promise<string> {
    const chatId = validatePeerId(operation.recipient.id);
    if (operation.kind === "reply") validateMessageId(operation.messageId);
    let possibleSubmission = false;
    try {
      return await this.queue(operation.accountId).run(async (page, signal) => {
        if (session && page !== session)
          throw new AppError("BROWSER_CLOSED", "The approved browser session changed");
        const deadline =
          Date.now() + (this.options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT);
        if (Date.now() >= operation.expiresAt) {
          throw new AppError("PERMISSION_DENIED", "Confirmation expired before execution");
        }
        await this.requireMain(page);
        if ((await activePeer(page, chatId).count()) !== 1) {
          await this.openChatPage(page, chatId);
        }
        const info = await this.readOpenChatInfo(page);
        if (info.id !== chatId || !info.titleVisible || info.title !== operation.recipient.title) {
          throw new AppError("TELEGRAM_UI_CHANGED", "Approved destination could not be verified");
        }
        return submitThroughComposer(
          page,
          operation,
          signal,
          this.loadingTimeout,
          (possible) => {
            possibleSubmission = possible;
          },
          deadline,
        );
      });
    } catch (error) {
      if (possibleSubmission)
        throw new AppError("OUTCOME_UNKNOWN", "Telegram submission could not be verified");
      if (error instanceof AppError) throw error;
      throw new AppError("TELEGRAM_UI_CHANGED", "Telegram composer could not be verified");
    }
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

  private async requireMain(page: Page): Promise<void> {
    const surface = await detectMainSurface(createTelegramDomProbe(page));
    if (surface === "login_required")
      throw new AppError("LOGIN_REQUIRED", "Sign in to Telegram Web");
    if (surface !== "ready") {
      throw new AppError("TELEGRAM_UI_CHANGED", "Telegram chat surface is unavailable", {
        retryable: true,
      });
    }
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
      (elements, { max, selectors }) =>
        elements
          .slice(0, max)
          .map((element) => {
            const id = element.getAttribute("data-peer-id") ?? "";
            const titleElement = selectors.chatRowTitle
              .map((selector) => element.querySelector(selector))
              .find(Boolean);
            const previewElement = element.querySelector(selectors.chatRowPreview.join(", "));
            const unreadBadge = element.querySelector(selectors.chatUnread.join(", "));
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
              title: title.slice(0, 256),
              type: "unknown" as const,
              unread,
              ...(preview ? { lastMessagePreview: preview.slice(0, 256) } : {}),
            };
          })
          .filter((chat) => chat.id !== "" && chat.title !== "")
          .slice(0, max),
      {
        max: limit,
        selectors: {
          chatRowTitle: SELECTORS.chatRowTitle,
          chatRowPreview: SELECTORS.chatRowPreview,
          chatUnread: SELECTORS.chatUnread,
        },
      },
    ) as Promise<ChatSummary[]>;
  }

  private async openChatPage(page: Page, chatId: string): Promise<OpenChatInfo> {
    await this.requireMain(page);
    if (!/^-?\d+$/.test(chatId)) throw new AppError("INVALID_ARGUMENT", "Invalid Telegram chat id");
    const row = page.locator(`${SELECTORS.chatRows[0]}[data-peer-id="${chatId}"]:visible`);
    if ((await row.count()) !== 1) {
      throw new AppError("CHAT_NOT_FOUND", "Chat was not found in the current list");
    }
    await row.click({ timeout: this.loadingTimeout });
    await page
      .locator(SELECTORS.activeChat)
      .locator(`${SELECTORS.activeChatPeer}[data-peer-id="${chatId}"]`)
      .waitFor({ state: "visible", timeout: this.loadingTimeout })
      .catch(() => {
        throw new AppError("TELEGRAM_UI_CHANGED", "The requested chat could not be verified", {
          retryable: true,
        });
      });
    return this.readOpenChatInfo(page);
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
    chatId?: string,
  ): Promise<ReadMessagesResult> {
    const snapshot = await page
      .locator(chatId === undefined ? SELECTORS.messageRows[0] : SELECTORS.activeChat)
      .evaluateAll(
        (elements, input) => {
          let rows = elements;
          if (input.chatId !== undefined) {
            const active = elements.length === 1 ? elements[0] : undefined;
            const peers = active?.querySelectorAll(input.peer);
            const list = active?.querySelector(input.list);
            if (
              !list ||
              peers?.length !== 1 ||
              peers[0]?.getAttribute("data-peer-id") !== input.chatId
            ) {
              return null;
            }
            rows = Array.from(list.querySelectorAll(input.row));
          }
          return {
            totalVisible: rows.length,
            messages: rows.slice(-input.limit).map((element) => ({
              id: element.getAttribute("data-mid") ?? "",
              classes: Array.from(element.classList),
              text: input.includeText
                ? (element.querySelector(input.text)?.textContent ?? "").trim()
                : null,
              sender: (element.querySelector(input.sender)?.textContent ?? "").trim(),
              timestamp: element.getAttribute("data-timestamp"),
            })),
          };
        },
        {
          chatId,
          limit,
          includeText,
          peer: SELECTORS.activeChatPeer,
          list: SELECTORS.activeMessageList,
          row: SELECTORS.activeChatMessages,
          text: SELECTORS.messageTextWithinRow,
          sender: SELECTORS.messageSenderWithinRow,
        },
      );
    if (!snapshot) {
      throw new AppError("TELEGRAM_UI_CHANGED", "The requested chat is no longer active");
    }
    const { totalVisible, messages } = snapshot;
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
