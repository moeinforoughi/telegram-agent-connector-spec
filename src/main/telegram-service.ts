import type { UiHealth } from "../core/telegram/ui-map";
import type { AccountView } from "../shared/account";
import { AppError } from "../shared/errors";
import {
  AGENT_LIMITS,
  type AgentChat,
  type AgentChatMessages,
  type AgentRecipientResolution,
} from "../shared/telegram";
import type { RecipientResolver } from "./recipient-resolver";
import type { TelegramReadAdapter } from "./telegram-read-adapter";
import type {
  MessageOperationRef,
  ReplyMessageRequest,
  SendMessageRequest,
} from "../shared/messaging";
import { MessageOperations, type ApproveMessage } from "./message-operations";

export type TelegramServiceDeps = {
  readonly listAccounts: () => readonly AccountView[];
  readonly adapter: Pick<
    TelegramReadAdapter,
    "listChats" | "searchChats" | "readChatMessages" | "getUiHealth"
  >;
  readonly resolver: Pick<RecipientResolver, "resolve" | "select">;
  readonly messaging?: Pick<TelegramReadAdapter, "inspectReply" | "submitMessage">;
  readonly messageSession?: (id: string) => object | undefined;
};

function agentLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new AppError("INVALID_ARGUMENT", "Invalid result limit");
  }
  return Math.min(value, maximum);
}

/**
 * Transport-independent Telegram capability layer. IPC uses it today; the
 * Phase 5 MCP bridge will reuse the same methods. Limits are enforced here so
 * neither the renderer nor an agent can request unbounded output.
 */
export class TelegramService {
  private readonly deps: TelegramServiceDeps;
  private readonly messaging: MessageOperations | undefined;

  constructor(deps: TelegramServiceDeps) {
    this.deps = deps;
    const adapter = deps.messaging;
    if (adapter) {
      this.messaging = new MessageOperations({
        accountLabel: (id) => {
          const account = this.requireAccount(id);
          if (account.status !== "connected") {
            throw new AppError(
              "ACCOUNT_NOT_CONNECTED",
              "Connect this account before preparing a message",
            );
          }
          return account.label;
        },
        resolve: (id, query) => deps.resolver.resolve(id, query, { usePreviousSelection: false }),
        select: (id, query, peer) => this.selectRecipient(id, query, peer),
        inspectReply: (id, chat, message) => adapter.inspectReply(id, chat, message),
        execute: (operation, session, query) => adapter.submitMessage(operation, session, query),
        ...(deps.messageSession ? { session: deps.messageSession } : {}),
      });
    }
  }

  prepareSend(request: SendMessageRequest) {
    return this.messageOperations.prepareSend(request);
  }

  prepareReply(request: ReplyMessageRequest) {
    return this.messageOperations.prepareReply(request);
  }

  confirmMessage(ref: MessageOperationRef, approve: ApproveMessage) {
    return this.messageOperations.confirm(ref, approve);
  }

  cancelMessage(ref: MessageOperationRef) {
    return this.messageOperations.cancel(ref);
  }

  private get messageOperations(): MessageOperations {
    if (!this.messaging) throw new AppError("UNSUPPORTED_OPERATION", "Messaging is unavailable");
    return this.messaging;
  }

  getAccounts(): AccountView[] {
    return this.deps.listAccounts().filter((account) => account.id !== null);
  }

  getAccountStatus(accountId: string): AccountView {
    return this.requireAccount(accountId);
  }

  async searchChats(
    accountId: string,
    query: string,
    options: { limit?: number } = {},
  ): Promise<readonly AgentChat[]> {
    this.requireAccount(accountId);
    const limit = agentLimit(options.limit, AGENT_LIMITS.searchResults, AGENT_LIMITS.searchResults);
    return this.deps.adapter.searchChats(accountId, query, { limit });
  }

  async resolveRecipient(accountId: string, query: string): Promise<AgentRecipientResolution> {
    this.requireAccount(accountId);
    return this.deps.resolver.resolve(accountId, query);
  }

  async selectRecipient(
    accountId: string,
    query: string,
    recipientId: string,
  ): Promise<AgentRecipientResolution> {
    this.requireAccount(accountId);
    return this.deps.resolver.select(accountId, query, recipientId);
  }

  async getChatList(
    accountId: string,
    options: { limit?: number } = {},
  ): Promise<readonly AgentChat[]> {
    this.requireAccount(accountId);
    const limit = agentLimit(options.limit, AGENT_LIMITS.chatList, AGENT_LIMITS.chatList);
    return this.deps.adapter.listChats(accountId, { limit });
  }

  async getChatMessages(
    accountId: string,
    chatId: string,
    options: { limit?: number; includeText?: boolean } = {},
  ): Promise<AgentChatMessages> {
    this.requireAccount(accountId);
    const limit = agentLimit(options.limit, AGENT_LIMITS.messagesDefault, AGENT_LIMITS.messagesMax);
    const result = await this.deps.adapter.readChatMessages(accountId, chatId, {
      limit,
      includeText: options.includeText ?? true,
    });
    return {
      chatId: chatId.trim(),
      opened: result.opened,
      messages: result.messages,
      truncated: result.truncated,
    };
  }

  async getUiHealth(accountId: string): Promise<UiHealth> {
    this.requireAccount(accountId);
    return this.deps.adapter.getUiHealth(accountId);
  }

  private requireAccount(accountId: string): AccountView {
    const account = this.deps.listAccounts().find((view) => view.id === accountId);
    if (!account) throw new AppError("ACCOUNT_NOT_FOUND", "Account was not found");
    return account;
  }
}
