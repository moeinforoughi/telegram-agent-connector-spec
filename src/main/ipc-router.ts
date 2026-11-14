import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { AccountView } from "../shared/account";
import { AppError, type SerializedError } from "../shared/errors";
import {
  IPC_ALLOWLIST,
  IPC_CHANNELS,
  IPC_EVENTS,
  type AccountIdRequest,
  type CreateAccountRequest,
  type IpcChannel,
  type IpcResult,
  type RemoveAccountRequest,
  type RenameAccountRequest,
} from "../shared/ipc";
import type {
  ProxyProtocol,
  ProxySettingsView,
  ProxyTestRequest,
  ProxyTestResult,
  SaveProxySettingsRequest,
} from "../shared/proxy";
import type { AppInfo } from "../shared/types";
import { runIpcHandler } from "./ipc-result";
import type { TelegramService } from "./telegram-service";
import { MAX_MESSAGE_LENGTH } from "../shared/messaging";
import type { ApproveMessage } from "./message-operations";
import { isTrustedSender } from "./trusted-sender";

const PERMISSION_DENIED: SerializedError = {
  code: "PERMISSION_DENIED",
  message: "Untrusted IPC sender",
  retryable: false,
};

export type IpcHandlers = {
  readonly getAppInfo: () => AppInfo;
  readonly listAccounts: () => AccountView[];
  readonly createAccount: (request: CreateAccountRequest) => AccountView;
  readonly renameAccount: (request: RenameAccountRequest) => AccountView;
  readonly startAccount: (request: AccountIdRequest) => Promise<AccountView>;
  readonly stopAccount: (request: AccountIdRequest) => Promise<AccountView>;
  readonly openTelegram: (request: AccountIdRequest) => Promise<AccountView>;
  readonly removeAccount: (request: RemoveAccountRequest) => Promise<{ readonly removed: true }>;
  readonly getProxySettings: () => Promise<ProxySettingsView>;
  readonly saveProxySettings: (request: SaveProxySettingsRequest) => Promise<ProxySettingsView>;
  readonly testProxy: (request: ProxyTestRequest) => Promise<ProxyTestResult>;
  readonly approveMessage: ApproveMessage;
  readonly telegram: Pick<
    TelegramService,
    | "getAccountStatus"
    | "getChatList"
    | "searchChats"
    | "resolveRecipient"
    | "selectRecipient"
    | "getChatMessages"
    | "getUiHealth"
    | "prepareSend"
    | "prepareReply"
    | "confirmMessage"
    | "cancelMessage"
  >;
};

export function registerIpcHandlers(window: BrowserWindow, handlers: IpcHandlers): void {
  for (const channel of IPC_ALLOWLIST) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (event, payload: unknown) =>
      handleTrusted(event, window, () => runHandler(handlers, channel, payload)),
    );
  }
}

export function sendAccountStatus(window: BrowserWindow, view: AccountView): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) return;
  window.webContents.send(IPC_EVENTS.accountStatus, view);
}

function invalidArgument(message = "Invalid request payload"): AppError {
  return new AppError("INVALID_ARGUMENT", message);
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) throw invalidArgument();
  return payload as Record<string, unknown>;
}

function parseAccountId(payload: unknown): AccountIdRequest {
  const id = asRecord(payload).id;
  if (typeof id !== "string" || id.trim() === "") throw invalidArgument("Invalid account id");
  return { id };
}

function parseCreateAccountRequest(payload: unknown): CreateAccountRequest {
  const label = asRecord(payload).label;
  if (label !== undefined && typeof label !== "string") {
    throw invalidArgument("Invalid account label");
  }
  return label === undefined ? {} : { label };
}

function parseRenameAccountRequest(payload: unknown): RenameAccountRequest {
  const record = asRecord(payload);
  if (typeof record.label !== "string") throw invalidArgument("Invalid account label");
  return { id: parseAccountId(payload).id, label: record.label };
}

function parseRemoveAccountRequest(payload: unknown): RemoveAccountRequest {
  const deleteProfile = asRecord(payload).deleteProfile;
  if (typeof deleteProfile !== "boolean") {
    throw new AppError("INVALID_ARGUMENT", "Invalid account removal request");
  }
  return { id: parseAccountId(payload).id, deleteProfile };
}

function parseProxyProtocol(value: unknown): ProxyProtocol {
  if (value === "socks5" || value === "http") return value;
  throw invalidArgument();
}

function parseProxyFields(payload: unknown): ProxyTestRequest {
  const record = asRecord(payload);
  const protocol = parseProxyProtocol(record.protocol);
  const host = record.host;
  const port = record.port;
  const username = record.username;
  if (typeof host !== "string" || typeof username !== "string") throw invalidArgument();
  if (typeof port !== "number" || !Number.isInteger(port)) throw invalidArgument();

  const password = record.password;
  if (password !== undefined && typeof password !== "string") throw invalidArgument();
  return { protocol, host, port, username, ...(password !== undefined ? { password } : {}) };
}

function parseSaveProxySettingsRequest(payload: unknown): SaveProxySettingsRequest {
  const enabled = asRecord(payload).enabled;
  if (typeof enabled !== "boolean") throw invalidArgument();
  return { enabled, ...parseProxyFields(payload) };
}

function telegramString(payload: unknown, key: string, max: number): string {
  const value = asRecord(payload)[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) throw invalidArgument();
  return value.trim();
}

function telegramLimit(payload: unknown): { limit?: number } {
  const limit = asRecord(payload).limit;
  if (limit === undefined) return {};
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1)
    throw invalidArgument();
  return { limit };
}

function runHandler(handlers: IpcHandlers, channel: IpcChannel, payload: unknown): unknown {
  switch (channel) {
    case IPC_CHANNELS.getAppInfo:
      return handlers.getAppInfo();
    case IPC_CHANNELS.listAccounts:
      return handlers.listAccounts();
    case IPC_CHANNELS.createAccount:
      return handlers.createAccount(parseCreateAccountRequest(payload));
    case IPC_CHANNELS.renameAccount:
      return handlers.renameAccount(parseRenameAccountRequest(payload));
    case IPC_CHANNELS.startAccount:
      return handlers.startAccount(parseAccountId(payload));
    case IPC_CHANNELS.stopAccount:
      return handlers.stopAccount(parseAccountId(payload));
    case IPC_CHANNELS.openTelegram:
      return handlers.openTelegram(parseAccountId(payload));
    case IPC_CHANNELS.removeAccount:
      return handlers.removeAccount(parseRemoveAccountRequest(payload));
    case IPC_CHANNELS.getProxySettings:
      return handlers.getProxySettings();
    case IPC_CHANNELS.saveProxySettings:
      return handlers.saveProxySettings(parseSaveProxySettingsRequest(payload));
    case IPC_CHANNELS.testProxy:
      return handlers.testProxy(parseProxyFields(payload));
    case IPC_CHANNELS.getAccountStatus:
      return handlers.telegram.getAccountStatus(telegramString(payload, "id", 128));
    case IPC_CHANNELS.getChatList:
      return handlers.telegram.getChatList(
        telegramString(payload, "id", 128),
        telegramLimit(payload),
      );
    case IPC_CHANNELS.searchChats:
      return handlers.telegram.searchChats(
        telegramString(payload, "id", 128),
        telegramString(payload, "query", 200),
        telegramLimit(payload),
      );
    case IPC_CHANNELS.resolveRecipient:
      return handlers.telegram.resolveRecipient(
        telegramString(payload, "id", 128),
        telegramString(payload, "query", 200),
      );
    case IPC_CHANNELS.selectRecipient:
      return handlers.telegram.selectRecipient(
        telegramString(payload, "id", 128),
        telegramString(payload, "query", 200),
        telegramString(payload, "recipientId", 128),
      );
    case IPC_CHANNELS.getChatMessages: {
      const { includeText } = asRecord(payload);
      if (includeText !== undefined && typeof includeText !== "boolean") throw invalidArgument();
      return handlers.telegram.getChatMessages(
        telegramString(payload, "id", 128),
        telegramString(payload, "chatId", 128),
        {
          ...telegramLimit(payload),
          ...(includeText === undefined ? {} : { includeText }),
        },
      );
    }
    case IPC_CHANNELS.getUiHealth:
      return handlers.telegram.getUiHealth(telegramString(payload, "id", 128));
    case IPC_CHANNELS.prepareSend: {
      const selected = asRecord(payload).recipientId;
      return handlers.telegram.prepareSend({
        accountId: telegramString(payload, "accountId", 128),
        recipientQuery: telegramString(payload, "recipientQuery", 200),
        ...(selected === undefined
          ? {}
          : { recipientId: telegramString(payload, "recipientId", 20) }),
        text: messageText(payload),
      });
    }
    case IPC_CHANNELS.prepareReply:
      return handlers.telegram.prepareReply({
        accountId: telegramString(payload, "accountId", 128),
        chatId: telegramString(payload, "chatId", 21),
        messageId: telegramString(payload, "messageId", 20),
        text: messageText(payload),
      });
    case IPC_CHANNELS.confirmMessage:
      return handlers.telegram.confirmMessage(messageRef(payload), handlers.approveMessage);
    case IPC_CHANNELS.cancelMessage:
      return handlers.telegram.cancelMessage(messageRef(payload));
  }
}

function messageText(payload: unknown): string {
  const { text } = asRecord(payload);
  if (typeof text !== "string" || !text.trim() || text.length > MAX_MESSAGE_LENGTH)
    throw invalidArgument();
  return text;
}

function messageRef(payload: unknown) {
  const operationId = telegramString(payload, "operationId", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId))
    throw invalidArgument();
  return { operationId, accountId: telegramString(payload, "accountId", 128) };
}

async function handleTrusted<T>(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  handler: () => T | Promise<T>,
): Promise<IpcResult<T>> {
  const trusted = isTrustedSender(
    event.sender.id,
    event.senderFrame === window.webContents.mainFrame,
    window.webContents.id,
    event.senderFrame?.url ?? null,
    window.webContents.getURL(),
  );

  if (!trusted) {
    return { ok: false, error: PERMISSION_DENIED };
  }

  return runIpcHandler(handler);
}
