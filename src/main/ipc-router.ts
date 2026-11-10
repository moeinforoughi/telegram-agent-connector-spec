import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { AccountView } from "../shared/account";
import { AppError, type SerializedError } from "../shared/errors";
import {
  IPC_ALLOWLIST,
  IPC_CHANNELS,
  IPC_EVENTS,
  type IpcChannel,
  type IpcResult,
  type RemoveAccountRequest,
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
import { isTrustedSender } from "./trusted-sender";

const PERMISSION_DENIED: SerializedError = {
  code: "PERMISSION_DENIED",
  message: "Untrusted IPC sender",
  retryable: false,
};

export type IpcHandlers = {
  readonly getAppInfo: () => AppInfo;
  readonly getAccount: () => AccountView;
  readonly startAccount: () => Promise<AccountView>;
  readonly stopAccount: () => Promise<AccountView>;
  readonly openTelegram: () => Promise<AccountView>;
  readonly removeAccount: (request: RemoveAccountRequest) => Promise<AccountView>;
  readonly getProxySettings: () => Promise<ProxySettingsView>;
  readonly saveProxySettings: (request: SaveProxySettingsRequest) => Promise<ProxySettingsView>;
  readonly testProxy: (request: ProxyTestRequest) => Promise<ProxyTestResult>;
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

function invalidArgument(): AppError {
  return new AppError("INVALID_ARGUMENT", "Invalid request payload");
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) throw invalidArgument();
  return payload as Record<string, unknown>;
}

function parseRemoveAccountRequest(payload: unknown): RemoveAccountRequest {
  const deleteProfile = asRecord(payload).deleteProfile;
  if (typeof deleteProfile !== "boolean") {
    throw new AppError("INVALID_ARGUMENT", "Invalid account removal request");
  }
  return { deleteProfile };
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

function runHandler(handlers: IpcHandlers, channel: IpcChannel, payload: unknown): unknown {
  switch (channel) {
    case IPC_CHANNELS.getAppInfo:
      return handlers.getAppInfo();
    case IPC_CHANNELS.getAccount:
      return handlers.getAccount();
    case IPC_CHANNELS.startAccount:
      return handlers.startAccount();
    case IPC_CHANNELS.stopAccount:
      return handlers.stopAccount();
    case IPC_CHANNELS.openTelegram:
      return handlers.openTelegram();
    case IPC_CHANNELS.removeAccount:
      return handlers.removeAccount(parseRemoveAccountRequest(payload));
    case IPC_CHANNELS.getProxySettings:
      return handlers.getProxySettings();
    case IPC_CHANNELS.saveProxySettings:
      return handlers.saveProxySettings(parseSaveProxySettingsRequest(payload));
    case IPC_CHANNELS.testProxy:
      return handlers.testProxy(parseProxyFields(payload));
  }
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
