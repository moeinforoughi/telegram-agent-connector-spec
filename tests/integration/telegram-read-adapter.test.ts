import fs from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TelegramReadAdapter } from "../../src/main/telegram-read-adapter";

const fixtures = path.join(process.cwd(), "tests", "fixtures", "telegram");
const pages: Page[] = [];
let browser: Browser;

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixtures, name), "utf8");
}

async function load(name: string): Promise<Page> {
  const page = await browser.newPage();
  pages.push(page);
  await page.setContent(fixture(name));
  return page;
}

function adapterFor(pageMap: Map<string, Page>, loadingTimeoutMs = 1_000): TelegramReadAdapter {
  return new TelegramReadAdapter({
    pageSource: (accountId) => pageMap.get(accountId),
    operationTimeoutMs: 1_500,
    loadingTimeoutMs,
    maxChats: 10,
    maxMessages: 10,
  });
}

beforeAll(async () => {
  if (!fs.existsSync(chromium.executablePath())) {
    throw new Error("Chromium for Playwright is missing");
  }
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  for (const page of pages) await page.close().catch(() => undefined);
  await browser.close();
});

describe("TelegramReadAdapter (synthetic pages)", () => {
  it("lists chats without opening any chat", async () => {
    const page = await load("surface-chat-list.html");
    const adapter = adapterFor(new Map([["a", page]]));

    const chats = await adapter.listChats("a", { limit: 10 });

    expect(chats).toHaveLength(2);
    expect(chats.map((chat) => chat.title)).toEqual(["Chat A", "Chat B"]);
    expect(chats.every((chat) => chat.type === "unknown")).toBe(true);
    expect(await page.locator("#column-center .chat.active").count()).toBe(0);
  });

  it("searches chats without opening them and reads preview/unread", async () => {
    const page = await load("surface-search-results.html");
    const adapter = adapterFor(new Map([["a", page]]));

    const chats = await adapter.searchChats("a", "query", { limit: 10 });

    expect(chats).toHaveLength(2);
    expect(chats[0]).toMatchObject({
      id: "2001",
      title: "Result A",
      unread: true,
      lastMessagePreview: "preview A",
    });
    expect(chats[1]).toMatchObject({ id: "2002", unread: false });
    expect(await page.locator("#column-center .chat.active").count()).toBe(0);
  });

  it("returns an empty search result without opening a chat", async () => {
    const page = await load("surface-search-empty.html");
    const adapter = adapterFor(new Map([["a", page]]));

    await expect(adapter.searchChats("a", "nothing")).resolves.toEqual([]);
    expect(await page.locator("#column-center .chat.active").count()).toBe(0);
  });

  it("recognizes the self subtitle and excludes message hits and phone metadata", async () => {
    const page = await load("surface-search-results.html");
    await page.locator(".search-super").evaluate((panel) => {
      panel.innerHTML = `
        <a class="chatlist-chat" data-peer-id="101"><span class="peer-title">Account display name</span>
          <span class="dialog-subtitle"><span class="i18n">Chat with yourself</span></span></a>
        <a class="chatlist-chat" data-peer-id="102"><span class="peer-title">Saved Messages</span>
          <span class="dialog-subtitle"><span dir="ltr">@other_peer</span></span></a>
        <a class="chatlist-chat" data-peer-id="103"><span class="peer-title">Contact</span>
          <span class="dialog-subtitle"><span dir="ltr">+000123</span></span></a>
        <a class="chatlist-chat" data-peer-id="104" data-mid="9"><span class="peer-title">Message hit</span></a>`;
    });
    const adapter = adapterFor(new Map([["a", page]]));
    const result = await adapter.searchChats("a", "saved");
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: "101",
      title: "Saved Messages",
      type: "self",
      isSelfChat: true,
      subtitle: "Chat with yourself",
    });
    expect(result[1]).toMatchObject({ id: "102", type: "unknown", username: "@other_peer" });
    expect(JSON.stringify(result)).not.toContain("+000123");
  });

  it("reads the chat list state and open-chat info", async () => {
    const listPage = await load("surface-chat-list.html");
    const openPage = await load("surface-open-chat.html");
    const adapter = adapterFor(
      new Map([
        ["list", listPage],
        ["open", openPage],
      ]),
    );

    await expect(adapter.getChatListState("list")).resolves.toEqual({
      state: "ready",
      itemCount: 2,
    });
    await expect(adapter.getOpenChatInfo("open")).resolves.toEqual({
      id: null,
      title: "Chat A",
      type: "user",
      titleVisible: true,
    });
  });

  it("opens an explicit chat and reads its messages", async () => {
    const page = await load("surface-openable.html");
    const adapter = adapterFor(new Map([["a", page]]));

    const info = await adapter.openChat("a", "4001");
    expect(info).toMatchObject({ id: "4001", title: "Openable Chat", type: "user" });

    const result = await adapter.readVisibleMessages("a", { limit: 5 });
    expect(result.totalVisible).toBe(1);
    expect(result.truncated).toBe(false);
    expect(result.messages).toEqual([{ id: "11", text: "hello", direction: "incoming" }]);
  });

  it("reads the requested peer and supports metadata-only output", async () => {
    const page = await load("surface-openable.html");
    const adapter = adapterFor(new Map([["a", page]]));
    await expect(
      adapter.readChatMessages("a", "4001", { includeText: false }),
    ).resolves.toMatchObject({
      opened: true,
      messages: [{ id: "11", direction: "incoming" }],
    });
    const second = await adapter.readChatMessages("a", "4001");
    expect(second.opened).toBe(false);
    expect(second.messages[0]?.text).toBe("hello");
  });

  it("fails closed when navigation opens a different peer", async () => {
    const page = await load("surface-openable.html");
    await page
      .locator(".chatlist-chat")
      .evaluate((row) => row.setAttribute("data-peer-id", "4999"));
    const adapter = adapterFor(new Map([["a", page]]), 400);
    await expect(adapter.readChatMessages("a", "4999")).rejects.toMatchObject({
      code: "TELEGRAM_UI_CHANGED",
    });
  });

  it("limits visible messages, classifies direction and strips text from metadata", async () => {
    const page = await load("surface-open-chat.html");
    const adapter = adapterFor(new Map([["a", page]]));

    const result = await adapter.readVisibleMessages("a", { limit: 2 });
    expect(result.totalVisible).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.messages.map((message) => message.id)).toEqual(["2", "3"]);
    expect(result.messages.map((message) => message.direction)).toEqual(["outgoing", "incoming"]);

    const metadata = await adapter.getMessageMetadata("a", { limit: 2 });
    expect(metadata.messages[0]).not.toHaveProperty("text");
    expect(metadata.messages.map((message) => message.id)).toEqual(["2", "3"]);
    await expect(adapter.getMessageCount("a")).resolves.toBe(3);
  });

  it("returns an empty message list for an empty chat", async () => {
    const page = await load("surface-empty-messages.html");
    const adapter = adapterFor(new Map([["a", page]]));

    await expect(adapter.readVisibleMessages("a")).resolves.toEqual({
      messages: [],
      totalVisible: 0,
      truncated: false,
    });
  });

  it("fails with TIMEOUT while message history stays loading", async () => {
    const page = await load("surface-message-loading.html");
    const adapter = adapterFor(new Map([["a", page]]), 150);

    await expect(adapter.readVisibleMessages("a")).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("fails with TELEGRAM_UI_CHANGED on an unknown UI", async () => {
    const page = await load("surface-ui-changed.html");
    const adapter = adapterFor(new Map([["a", page]]), 100);

    await expect(adapter.readVisibleMessages("a")).rejects.toMatchObject({
      code: "TELEGRAM_UI_CHANGED",
    });
  });

  it("keeps account pages and queues isolated", async () => {
    const first = await load("surface-chat-list.html");
    const second = await load("surface-empty-list.html");
    const adapter = adapterFor(
      new Map([
        ["one", first],
        ["two", second],
      ]),
    );

    const [firstChats, secondChats] = await Promise.all([
      adapter.listChats("one"),
      adapter.listChats("two"),
    ]);

    expect(firstChats.map((chat) => chat.title)).toEqual(["Chat A", "Chat B"]);
    expect(secondChats).toEqual([]);
  });

  it("rejects when the account has no live page", async () => {
    const adapter = adapterFor(new Map());

    await expect(adapter.listChats("missing")).rejects.toMatchObject({ code: "BROWSER_CLOSED" });
  });
});
