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

function parseRemoveAccountRequest(payload: unknown): RemoveAccountRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new AppError("INVALID_ARGUMENT", "Invalid account removal request");
  }
  const deleteProfile = (payload as Partial<RemoveAccountRequest>).deleteProfile;
  if (typeof deleteProfile !== "boolean") {
    throw new AppError("INVALID_ARGUMENT", "Invalid account removal request");
  }
  return { deleteProfile };
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
