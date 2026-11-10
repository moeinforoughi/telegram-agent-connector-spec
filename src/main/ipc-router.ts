import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { SerializedError } from "../shared/errors";
import { IPC_ALLOWLIST, IPC_CHANNELS, type IpcChannel, type IpcResult } from "../shared/ipc";
import type { AppInfo } from "../shared/types";
import { runIpcHandler } from "./ipc-result";
import { isTrustedSender } from "./trusted-sender";

const PERMISSION_DENIED: SerializedError = {
  code: "PERMISSION_DENIED",
  message: "Untrusted IPC sender",
  retryable: false,
};

export function registerIpcHandlers(window: BrowserWindow, getAppInfo: () => AppInfo): void {
  const handlers: Record<IpcChannel, () => AppInfo> = {
    [IPC_CHANNELS.getAppInfo]: getAppInfo,
  };

  for (const channel of IPC_ALLOWLIST) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (event) => handleTrusted(event, window, handlers[channel]));
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
