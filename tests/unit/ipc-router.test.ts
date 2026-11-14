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
    telegram: {
      getAccountStatus: vi.fn(() => view),
      getChatList: vi.fn(async () => []),
      searchChats: vi.fn(async () => []),
      resolveRecipient: vi.fn(async () => ({ status: "not_found" as const })),
      selectRecipient: vi.fn(async () => ({ status: "not_found" as const })),
      getChatMessages: vi.fn(async () => ({
        chatId: "1",
        opened: false,
        messages: [],
        truncated: false,
      })),
      getUiHealth: vi.fn(async () => ({ status: "ready" as const, routes: [] })),
      prepareSend: vi.fn(async () => ({ status: "ambiguous" as const, candidates: [] })),
      prepareReply: vi.fn(async () => {
        throw new Error("Unexpected fixture reply");
      }),
      confirmMessage: vi.fn(async () => ({ status: "cancelled" as const, operationId: "fixture" })),
      cancelMessage: vi.fn(() => ({ status: "cancelled" as const, operationId: "fixture" })),
    },
    approveMessage: vi.fn(async () => false),
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

    expect(ipc.removeHandler).toHaveBeenCalledTimes(22);
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
      "telegram:account-status",
      "telegram:chat-list",
      "telegram:search",
      "telegram:resolve-recipient",
      "telegram:select-recipient",
      "telegram:chat-messages",
      "telegram:ui-health",
      "telegram:prepare-send",
      "telegram:prepare-reply",
      "telegram:confirm-message",
      "telegram:cancel-message",
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

  it("validates Telegram inputs and only dispatches from the trusted frame", async () => {
    const { window, mainFrame } = makeWindow();
    const handlers = makeHandlers();
    registerIpcHandlers(window, handlers);
    const search = handlerFor("telegram:search");
    const request = { id: view.id, query: "Alice", limit: 3 };
    await expect(search(makeEvent(mainFrame, 8), request)).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" },
    });
    for (const invalid of [
      { query: " " },
      { limit: 1.5 },
      { limit: 0 },
      { query: "a".repeat(201) },
    ]) {
      await expect(search(makeEvent(mainFrame), { ...request, ...invalid })).resolves.toMatchObject(
        {
          error: { code: "INVALID_ARGUMENT" },
        },
      );
    }
    expect(handlers.telegram.searchChats).not.toHaveBeenCalled();
    await expect(search(makeEvent(mainFrame), request)).resolves.toEqual({ ok: true, data: [] });
    expect(handlers.telegram.searchChats).toHaveBeenCalledWith(view.id, "Alice", { limit: 3 });
  });

  it("validates operation references and supplies approval from Main", async () => {
    const { window, mainFrame } = makeWindow();
    const handlers = makeHandlers();
    registerIpcHandlers(window, handlers);
    const confirm = handlerFor("telegram:confirm-message");
    const ref = { accountId: view.id, operationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" };
    await expect(confirm(makeEvent(mainFrame, 8), ref)).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" },
    });
    await expect(
      confirm(makeEvent(mainFrame), { ...ref, operationId: "invalid" }),
    ).resolves.toMatchObject({ error: { code: "INVALID_ARGUMENT" } });
    expect(handlers.telegram.confirmMessage).not.toHaveBeenCalled();
    await expect(
      confirm(makeEvent(mainFrame), { ...ref, approved: true, text: "ignored" }),
    ).resolves.toMatchObject({ ok: true });
    expect(handlers.telegram.confirmMessage).toHaveBeenCalledWith(ref, handlers.approveMessage);
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
