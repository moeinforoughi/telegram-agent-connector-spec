import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcResult } from "../../src/shared/ipc";
import type { AppInfo } from "../../src/shared/types";

const ipc = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: ipc.handle, removeHandler: ipc.removeHandler },
}));

import { registerIpcHandlers } from "../../src/main/ipc-router";

const info: AppInfo = {
  appName: "Unofficial Telegram Agent Connector",
  appVersion: "0.1.0",
  platform: "win32",
};

function makeWindow(url = "file:///app/index.html") {
  const mainFrame = { url };
  const window = {
    webContents: {
      id: 7,
      mainFrame,
      getURL: () => url,
    },
  } as unknown as BrowserWindow;
  return { window, mainFrame };
}

function makeEvent(mainFrame: { url: string }, senderId = 7): IpcMainInvokeEvent {
  return {
    sender: { id: senderId },
    senderFrame: mainFrame,
  } as unknown as IpcMainInvokeEvent;
}

beforeEach(() => {
  ipc.handle.mockReset();
  ipc.removeHandler.mockReset();
});

describe("registerIpcHandlers", () => {
  it("registers exactly the allowlisted channel", () => {
    const { window } = makeWindow();

    registerIpcHandlers(window, () => info);

    expect(ipc.removeHandler).toHaveBeenCalledWith("app:get-info");
    expect(ipc.handle).toHaveBeenCalledTimes(1);
    expect(ipc.handle.mock.calls[0]?.[0]).toBe("app:get-info");
  });

  it("rejects an untrusted sender and accepts the app main frame", async () => {
    const { window, mainFrame } = makeWindow();
    registerIpcHandlers(window, () => info);
    const handler = ipc.handle.mock.calls[0]?.[1] as (
      event: IpcMainInvokeEvent,
    ) => Promise<IpcResult<AppInfo>>;

    await expect(handler(makeEvent(mainFrame, 8))).resolves.toEqual({
      ok: false,
      error: { code: "PERMISSION_DENIED", message: "Untrusted IPC sender", retryable: false },
    });
    await expect(handler(makeEvent(mainFrame))).resolves.toEqual({ ok: true, data: info });
  });

  it("rejects a main frame whose URL does not match the window", async () => {
    const { window, mainFrame } = makeWindow();
    registerIpcHandlers(window, () => info);
    const handler = ipc.handle.mock.calls[0]?.[1] as (
      event: IpcMainInvokeEvent,
    ) => Promise<IpcResult<AppInfo>>;

    mainFrame.url = "https://evil.example/";

    await expect(handler(makeEvent(mainFrame))).resolves.toEqual({
      ok: false,
      error: { code: "PERMISSION_DENIED", message: "Untrusted IPC sender", retryable: false },
    });
  });
});
