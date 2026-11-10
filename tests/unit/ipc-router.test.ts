import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountView } from "../../src/shared/account";
import type { IpcResult } from "../../src/shared/ipc";
import type { AppInfo } from "../../src/shared/types";

const ipc = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: ipc.handle, removeHandler: ipc.removeHandler },
}));

import { registerIpcHandlers, type IpcHandlers } from "../../src/main/ipc-router";

const info: AppInfo = {
  appName: "Unofficial Telegram Agent Connector",
  appVersion: "0.1.0",
  platform: "win32",
};

const view: AccountView = {
  id: "11111111-2222-3333-4444-555555555555",
  label: "Account 1",
  status: "disconnected",
};

function makeHandlers(): IpcHandlers {
  return {
    getAppInfo: () => info,
    getAccount: () => view,
    startAccount: async () => view,
    stopAccount: async () => view,
    openTelegram: async () => view,
    removeAccount: vi.fn(async () => view),
  };
}

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

function handlerFor(
  channel: string,
): (event: IpcMainInvokeEvent, payload?: unknown) => Promise<IpcResult<unknown>> {
  const call = ipc.handle.mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`Missing handler for ${channel}`);
  return call[1] as (event: IpcMainInvokeEvent, payload?: unknown) => Promise<IpcResult<unknown>>;
}

beforeEach(() => {
  ipc.handle.mockReset();
  ipc.removeHandler.mockReset();
});

describe("registerIpcHandlers", () => {
  it("registers exactly the allowlisted channels", () => {
    const { window } = makeWindow();

    registerIpcHandlers(window, makeHandlers());

    expect(ipc.removeHandler).toHaveBeenCalledTimes(6);
    expect(ipc.handle.mock.calls.map(([channel]) => channel)).toEqual([
      "app:get-info",
      "account:get",
      "account:start",
      "account:stop",
      "account:open",
      "account:remove",
    ]);
  });

  it("rejects an untrusted sender and accepts the app main frame", async () => {
    const { window, mainFrame } = makeWindow();
    registerIpcHandlers(window, makeHandlers());
    const handler = handlerFor("app:get-info");

    await expect(handler(makeEvent(mainFrame, 8))).resolves.toEqual({
      ok: false,
      error: { code: "PERMISSION_DENIED", message: "Untrusted IPC sender", retryable: false },
    });
    await expect(handler(makeEvent(mainFrame))).resolves.toEqual({ ok: true, data: info });
  });

  it("rejects a main frame whose URL does not match the window", async () => {
    const { window, mainFrame } = makeWindow();
    registerIpcHandlers(window, makeHandlers());
    const handler = handlerFor("app:get-info");

    mainFrame.url = "https://evil.example/";

    await expect(handler(makeEvent(mainFrame))).resolves.toEqual({
      ok: false,
      error: { code: "PERMISSION_DENIED", message: "Untrusted IPC sender", retryable: false },
    });
  });

  it("validates the remove-account payload before calling the controller", async () => {
    const { window, mainFrame } = makeWindow();
    const handlers = makeHandlers();
    registerIpcHandlers(window, handlers);
    const handler = handlerFor("account:remove");

    await expect(handler(makeEvent(mainFrame), { deleteProfile: "yes" })).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });
    expect(handlers.removeAccount).not.toHaveBeenCalled();

    await expect(handler(makeEvent(mainFrame), { deleteProfile: true })).resolves.toEqual({
      ok: true,
      data: view,
    });
    expect(handlers.removeAccount).toHaveBeenCalledWith({ deleteProfile: true });
  });
});
