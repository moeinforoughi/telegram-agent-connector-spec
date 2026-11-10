import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountView } from "../../src/shared/account";
import type { IpcResult } from "../../src/shared/ipc";
import type { ProxySettingsView, ProxyTestResult } from "../../src/shared/proxy";
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

const proxyView: ProxySettingsView = {
  enabled: true,
  protocol: "socks5",
  host: "127.0.0.1",
  port: 10808,
  username: "",
  hasPassword: false,
  secureStorageAvailable: true,
};

const proxyTest: ProxyTestResult = { status: "success", message: "Proxy tunnel established" };

function makeHandlers(): IpcHandlers {
  return {
    getAppInfo: () => info,
    listAccounts: () => [view],
    createAccount: vi.fn(() => view),
    renameAccount: vi.fn(() => view),
    startAccount: vi.fn(async () => view),
    stopAccount: vi.fn(async () => view),
    openTelegram: vi.fn(async () => view),
    removeAccount: vi.fn(async () => ({ removed: true as const })),
    getProxySettings: async () => proxyView,
    saveProxySettings: vi.fn(async () => proxyView),
    testProxy: vi.fn(async () => proxyTest),
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

    expect(ipc.removeHandler).toHaveBeenCalledTimes(11);
    expect(ipc.handle.mock.calls.map(([channel]) => channel)).toEqual([
      "app:get-info",
      "account:list",
      "account:create",
      "account:rename",
      "account:start",
      "account:stop",
      "account:open",
      "account:remove",
      "proxy:get",
      "proxy:save",
      "proxy:test",
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

  it("validates account id payloads", async () => {
    const { window, mainFrame } = makeWindow();
    const handlers = makeHandlers();
    registerIpcHandlers(window, handlers);
    const start = handlerFor("account:start");

    await expect(start(makeEvent(mainFrame), {})).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });
    await expect(start(makeEvent(mainFrame), { id: "" })).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });
    expect(handlers.startAccount).not.toHaveBeenCalled();

    await expect(start(makeEvent(mainFrame), { id: view.id })).resolves.toEqual({
      ok: true,
      data: view,
    });
    expect(handlers.startAccount).toHaveBeenCalledWith({ id: view.id });
  });

  it("validates create, rename and remove payloads", async () => {
    const { window, mainFrame } = makeWindow();
    const handlers = makeHandlers();
    registerIpcHandlers(window, handlers);

    const create = handlerFor("account:create");
    await expect(create(makeEvent(mainFrame), {})).resolves.toEqual({ ok: true, data: view });
    expect(handlers.createAccount).toHaveBeenCalledWith({});
    await expect(create(makeEvent(mainFrame), { label: 7 })).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_ARGUMENT" },
    });

    const rename = handlerFor("account:rename");
    await expect(rename(makeEvent(mainFrame), { id: view.id, label: "Personal" })).resolves.toEqual(
      {
        ok: true,
        data: view,
      },
    );
    expect(handlers.renameAccount).toHaveBeenCalledWith({ id: view.id, label: "Personal" });

    const remove = handlerFor("account:remove");
    await expect(
      remove(makeEvent(mainFrame), { id: view.id, deleteProfile: "yes" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(handlers.removeAccount).not.toHaveBeenCalled();
    await expect(
      remove(makeEvent(mainFrame), { id: view.id, deleteProfile: true }),
    ).resolves.toEqual({ ok: true, data: { removed: true } });
    expect(handlers.removeAccount).toHaveBeenCalledWith({ id: view.id, deleteProfile: true });
  });

  it("validates proxy payloads before calling the services", async () => {
    const { window, mainFrame } = makeWindow();
    const handlers = makeHandlers();
    registerIpcHandlers(window, handlers);

    const save = handlerFor("proxy:save");
    await expect(
      save(makeEvent(mainFrame), {
        enabled: true,
        protocol: "ftp",
        host: "127.0.0.1",
        port: 10808,
        username: "",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENT" } });
    expect(handlers.saveProxySettings).not.toHaveBeenCalled();

    const validSettings = {
      enabled: true,
      protocol: "socks5",
      host: "127.0.0.1",
      port: 10808,
      username: "",
    };
    await expect(save(makeEvent(mainFrame), validSettings)).resolves.toEqual({
      ok: true,
      data: proxyView,
    });
    expect(handlers.saveProxySettings).toHaveBeenCalledWith(validSettings);

    const test = handlerFor("proxy:test");
    await expect(
      test(makeEvent(mainFrame), {
        protocol: "http",
        host: "127.0.0.1",
        port: 8080,
        username: "user",
        password: "secret",
      }),
    ).resolves.toEqual({ ok: true, data: proxyTest });
  });
});
