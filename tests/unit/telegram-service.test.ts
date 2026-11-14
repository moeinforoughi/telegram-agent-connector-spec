import { describe, expect, it, vi } from "vitest";
import { TelegramService, type TelegramServiceDeps } from "../../src/main/telegram-service";
import type { AccountView } from "../../src/shared/account";
import { AppError } from "../../src/shared/errors";
import type { AgentChat, AgentMessage } from "../../src/shared/telegram";

const accounts: AccountView[] = [
  { id: "a1", label: "First", status: "connected" },
  { id: "a2", label: "Second", status: "disconnected" },
];

const chat: AgentChat = { id: "1001", title: "Alice", type: "user", unread: false };
const message: AgentMessage = { id: "9", direction: "incoming", text: "hello" };

type Adapter = TelegramServiceDeps["adapter"];

function setup(overrides: Partial<Adapter> = {}) {
  const adapter: Adapter = {
    listChats: vi.fn(async (_accountId: string, options: { limit?: number } = {}) =>
      Array.from({ length: options.limit ?? 0 }, (_value, index) => ({
        ...chat,
        id: String(index),
      })),
    ),
    searchChats: vi.fn(async (_accountId: string, _query: string, _options = {}) => [chat]),
    readChatMessages: vi.fn(async (_accountId: string, _chatId: string) => ({
      messages: [message],
      totalVisible: 1,
      truncated: false,
      opened: false,
    })),
    getUiHealth: vi.fn(async () => ({
      status: "ready" as const,
      routes: [{ name: "main" as const, status: "ok" as const }],
    })),
    ...overrides,
  };
  const resolver = {
    resolve: vi.fn(async () => ({
      status: "resolved" as const,
      recipient: chat,
      source: "search" as const,
    })),
    select: vi.fn(async () => ({
      status: "resolved" as const,
      recipient: chat,
      source: "selection" as const,
    })),
  };
  const service = new TelegramService({ listAccounts: () => accounts, adapter, resolver });
  return { service, adapter, resolver };
}

describe("TelegramService", () => {
  it("lists only usable accounts and reports one account status", () => {
    const { service } = setup();
    const list = [...accounts, { id: null, label: "Broken", status: "error" as const }];

    const withBroken = new TelegramService({
      listAccounts: () => list,
      adapter: setup().adapter,
      resolver: setup().resolver,
    });

    expect(service.getAccounts()).toEqual(accounts);
    expect(withBroken.getAccounts()).toEqual(accounts);
    expect(service.getAccountStatus("a2")).toEqual(accounts[1]);
  });

  it("rejects an unknown account before touching Telegram", async () => {
    const { service, adapter, resolver } = setup();

    await expect(service.searchChats("nope", "alice")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
    await expect(service.getChatList("nope")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
    await expect(service.getChatMessages("nope", "1001")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
    await expect(service.resolveRecipient("nope", "alice")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
    await expect(service.selectRecipient("nope", "alice", "1001")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
    await expect(service.getUiHealth("nope")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
    expect(() => service.getAccountStatus("nope")).toThrow(AppError);

    expect(adapter.searchChats).not.toHaveBeenCalled();
    expect(adapter.listChats).not.toHaveBeenCalled();
    expect(adapter.readChatMessages).not.toHaveBeenCalled();
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it("defaults search to five results and never returns more", async () => {
    const { service, adapter } = setup();

    await service.searchChats("a1", "alice");
    expect(adapter.searchChats).toHaveBeenLastCalledWith("a1", "alice", { limit: 5 });

    await service.searchChats("a1", "alice", { limit: 40 });
    expect(adapter.searchChats).toHaveBeenLastCalledWith("a1", "alice", { limit: 5 });

    await expect(service.searchChats("a1", "alice", { limit: 0 })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("caps the chat list at twenty entries", async () => {
    const { service, adapter } = setup();

    await service.getChatList("a1");
    expect(adapter.listChats).toHaveBeenLastCalledWith("a1", { limit: 20 });

    await service.getChatList("a1", { limit: 100 });
    expect(adapter.listChats).toHaveBeenLastCalledWith("a1", { limit: 20 });
  });

  it("reads ten messages by default, at most thirty, and returns a compact shape", async () => {
    const { service, adapter } = setup();

    const result = await service.getChatMessages("a1", "1001");
    expect(adapter.readChatMessages).toHaveBeenLastCalledWith("a1", "1001", {
      limit: 10,
      includeText: true,
    });
    expect(Object.keys(result).sort()).toEqual(["chatId", "messages", "opened", "truncated"]);
    expect(result).toEqual({
      chatId: "1001",
      opened: false,
      messages: [message],
      truncated: false,
    });

    await service.getChatMessages("a1", "1001", { limit: 99, includeText: false });
    expect(adapter.readChatMessages).toHaveBeenLastCalledWith("a1", "1001", {
      limit: 30,
      includeText: false,
    });
  });

  it("delegates recipient resolution and explicit selection", async () => {
    const { service, resolver } = setup();

    await service.resolveRecipient("a1", "alice");
    expect(resolver.resolve).toHaveBeenCalledWith("a1", "alice");

    await service.selectRecipient("a1", "alice", "1001");
    expect(resolver.select).toHaveBeenCalledWith("a1", "alice", "1001");
  });

  it("propagates a closed browser", async () => {
    const { service } = setup({
      searchChats: vi.fn(async () => {
        throw new AppError("BROWSER_CLOSED", "Browser is not available for this account");
      }),
    });

    await expect(service.searchChats("a1", "alice")).rejects.toMatchObject({
      code: "BROWSER_CLOSED",
    });
  });

  it("propagates network failures", async () => {
    const { service } = setup({
      readChatMessages: vi.fn(async () => {
        throw new AppError("NETWORK_ERROR", "Connection lost");
      }),
    });

    await expect(service.getChatMessages("a1", "1001")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("exposes the limited UI health check", async () => {
    const { service, adapter } = setup();

    await expect(service.getUiHealth("a1")).resolves.toMatchObject({ status: "ready" });
    expect(adapter.getUiHealth).toHaveBeenCalledWith("a1");
  });
});
