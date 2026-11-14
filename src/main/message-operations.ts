import { randomUUID } from "node:crypto";
import { AppError, toSerializedError } from "../shared/errors";
import {
  MAX_MESSAGE_LENGTH,
  type MessageOperationRef,
  type MessageOutcome,
  type PreparedMessage,
  type PrepareMessageResult,
  type ReplyMessageRequest,
  type SendMessageRequest,
} from "../shared/messaging";
import type { AgentRecipient, AgentRecipientResolution } from "../shared/telegram";

export type ApproveMessage = (operation: PreparedMessage) => Promise<boolean>;

type Dependencies = {
  readonly accountLabel: (id: string) => string;
  readonly resolve: (id: string, query: string) => Promise<AgentRecipientResolution>;
  readonly select: (id: string, query: string, peer: string) => Promise<AgentRecipientResolution>;
  readonly inspectReply: (
    id: string,
    chatId: string,
    messageId: string,
  ) => Promise<{ recipient: AgentRecipient; targetPreview: string }>;
  readonly execute: (
    operation: PreparedMessage,
    session?: object,
    query?: string,
  ) => Promise<string>;
  readonly session?: (id: string) => object | undefined;
  readonly now?: () => number;
};

const TTL_MS = 60_000;
const MAX_PENDING = 32;

export function validatePeerId(value: string): string {
  if (!/^-?[1-9]\d{0,19}$/.test(value)) throw new AppError("INVALID_ARGUMENT", "Invalid chat ID");
  return value;
}

export function validateMessageId(value: string): string {
  if (!/^[1-9]\d{0,19}$/.test(value)) throw new AppError("INVALID_ARGUMENT", "Invalid message ID");
  return value;
}

function validateText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  // Reject controls that cannot be reviewed faithfully in the native dialog.
  // eslint-disable-next-line no-control-regex
  const hiddenControls = /[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
  if (
    !normalized.trim() ||
    normalized.length > MAX_MESSAGE_LENGTH ||
    hiddenControls.test(normalized)
  ) {
    throw new AppError("INVALID_ARGUMENT", "Invalid message text");
  }
  return normalized;
}

export class MessageOperations {
  private readonly pending = new Map<
    string,
    { operation: PreparedMessage; session: object | undefined; query: string | undefined }
  >();
  private readonly approvingAccounts = new Set<string>();
  private readonly preparing = new Set<string>();
  private readonly now: () => number;

  constructor(private readonly deps: Dependencies) {
    this.now = deps.now ?? Date.now;
  }

  async prepareSend(request: SendMessageRequest): Promise<PrepareMessageResult> {
    const { accountId } = request;
    const accountLabel = this.deps.accountLabel(accountId);
    const text = validateText(request.text);
    const query = request.recipientQuery.trim();
    if (!query || query.length > 200)
      throw new AppError("INVALID_ARGUMENT", "Invalid recipient query");
    return this.prepare(accountId, async (session) => {
      const resolution =
        request.recipientId === undefined
          ? await this.deps.resolve(accountId, query)
          : await this.deps.select(accountId, query, validatePeerId(request.recipientId));
      if (resolution.status === "ambiguous") return resolution;
      if (resolution.status === "not_found")
        throw new AppError("CHAT_NOT_FOUND", "Recipient was not found");
      validatePeerId(resolution.recipient.id);
      return this.remember(
        { ...this.base(accountId, accountLabel, text, resolution.recipient), kind: "send" },
        session,
        query,
      );
    });
  }

  async prepareReply(request: ReplyMessageRequest): Promise<PreparedMessage> {
    const { accountId } = request;
    const accountLabel = this.deps.accountLabel(accountId);
    const text = validateText(request.text);
    const chatId = validatePeerId(request.chatId);
    const messageId = validateMessageId(request.messageId);
    return this.prepare(accountId, async (session) => {
      const { recipient, targetPreview } = await this.deps.inspectReply(
        accountId,
        chatId,
        messageId,
      );
      if (recipient.id !== chatId)
        throw new AppError("TELEGRAM_UI_CHANGED", "Reply chat could not be verified");
      return this.remember(
        {
          ...this.base(accountId, accountLabel, text, recipient),
          kind: "reply",
          messageId,
          targetPreview,
        },
        session,
      );
    });
  }

  cancel(ref: MessageOperationRef): MessageOutcome {
    const { operation } = this.take(ref);
    return { status: "cancelled", operationId: operation.operationId };
  }

  async confirm(ref: MessageOperationRef, approve: ApproveMessage): Promise<MessageOutcome> {
    if (this.approvingAccounts.has(ref.accountId)) {
      throw new AppError(
        "PERMISSION_DENIED",
        "A confirmation is already in progress for this account",
      );
    }
    const { operation, session, query } = this.take(ref);
    const { operationId, accountId } = operation;
    this.approvingAccounts.add(accountId);
    try {
      if (!(await approve(operation))) return { status: "cancelled", operationId };
      if (operation.expiresAt <= this.now() || this.deps.session?.(accountId) !== session)
        throw this.unavailable();
      try {
        this.deps.accountLabel(accountId);
        const messageId =
          query === undefined
            ? await this.deps.execute(operation, session)
            : await this.deps.execute(operation, session, query);
        return { status: "sent", accountId, chatId: operation.recipient.id, messageId };
      } catch (error) {
        if (error instanceof AppError && error.code === "OUTCOME_UNKNOWN") {
          return {
            status: "unknown_result",
            operationId,
            code: "OUTCOME_UNKNOWN",
            message: "Check the Telegram chat before attempting to send again.",
          };
        }
        return { status: "failed", operationId, error: toSerializedError(error) };
      }
    } finally {
      this.approvingAccounts.delete(accountId);
    }
  }

  private base(accountId: string, accountLabel: string, text: string, recipient: AgentRecipient) {
    return {
      status: "prepared" as const,
      confirmationRequired: true as const,
      accountId,
      accountLabel,
      text,
      recipient: Object.freeze({ ...recipient }),
      operationId: randomUUID(),
      expiresAt: this.now() + TTL_MS,
    };
  }

  private async prepare<T>(
    accountId: string,
    action: (session: object | undefined) => Promise<T>,
  ): Promise<T> {
    if (this.approvingAccounts.has(accountId) || this.preparing.has(accountId))
      throw this.unavailable();
    for (const [id, entry] of this.pending) {
      if (entry.operation.expiresAt <= this.now() || entry.operation.accountId === accountId)
        this.pending.delete(id);
    }
    this.preparing.add(accountId);
    try {
      return await action(this.deps.session?.(accountId));
    } finally {
      this.preparing.delete(accountId);
    }
  }

  private remember(
    operation: PreparedMessage,
    session: object | undefined,
    query?: string,
  ): PreparedMessage {
    if (this.deps.session?.(operation.accountId) !== session) throw this.unavailable();
    if (this.pending.size >= MAX_PENDING)
      throw new AppError("INVALID_ARGUMENT", "Too many pending confirmations");
    Object.freeze(operation);
    this.pending.set(operation.operationId, { operation, session, query });
    return operation;
  }

  private take(ref: MessageOperationRef) {
    const entry = this.pending.get(ref.operationId);
    if (!entry || entry.operation.accountId !== ref.accountId) throw this.unavailable();
    this.pending.delete(ref.operationId);
    if (
      entry.operation.expiresAt <= this.now() ||
      this.deps.session?.(ref.accountId) !== entry.session
    )
      throw this.unavailable();
    return entry;
  }

  private unavailable(): AppError {
    return new AppError("PERMISSION_DENIED", "Confirmation is expired or unavailable");
  }
}
