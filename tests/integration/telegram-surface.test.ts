import fs from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTelegramDomProbe,
  detectChannel,
  detectChatList,
  detectMainSurface,
  detectOpenChat,
  detectSearchState,
  readMessageStats,
} from "../../src/core/telegram/chat-surface";

const fixtures = path.join(process.cwd(), "tests", "fixtures", "telegram");

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixtures, name), "utf8");
}

let browser: Browser;
const pages: Page[] = [];

async function load(name: string): Promise<Page> {
  const page = await browser.newPage();
  pages.push(page);
  await page.setContent(fixture(name));
  return page;
}

beforeAll(async () => {
  const executable = chromium.executablePath();
  if (!fs.existsSync(executable)) {
    throw new Error("Chromium for Playwright is missing; run `npx playwright install chromium`");
  }
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  for (const page of pages) await page.close().catch(() => undefined);
  await browser.close();
});

describe("read-only Telegram surface fixtures", () => {
  it("detects the chat list and its item count", async () => {
    const page = await load("surface-chat-list.html");
    const probe = createTelegramDomProbe(page);

    expect(await detectMainSurface(probe)).toBe("ready");
    expect(await detectChatList(probe)).toEqual({ state: "ready", itemCount: 2 });
  });

  it("distinguishes empty and loading lists", async () => {
    const empty = createTelegramDomProbe(await load("surface-empty-list.html"));
    const loading = createTelegramDomProbe(await load("surface-loading.html"));

    expect(await detectChatList(empty)).toEqual({ state: "empty" });
    expect(await detectChatList(loading)).toEqual({ state: "loading" });
  });

  it("detects an open chat, title and message directions", async () => {
    const page = await load("surface-open-chat.html");
    const probe = createTelegramDomProbe(page);

    expect(await detectOpenChat(probe)).toEqual({
      open: true,
      type: "user",
      titleVisible: true,
    });
    expect(await readMessageStats(probe)).toEqual({
      total: 3,
      incoming: 2,
      outgoing: 1,
      channelPosts: 0,
    });
    expect(await detectChannel(probe)).toBe(false);
  });

  it("detects a channel and its posts", async () => {
    const probe = createTelegramDomProbe(await load("surface-channel.html"));

    expect(await detectOpenChat(probe)).toMatchObject({ open: true, type: "channel" });
    expect(await detectChannel(probe)).toBe(true);
    expect((await readMessageStats(probe)).channelPosts).toBe(1);
  });

  it("detects search no-results without reading the result text", async () => {
    const probe = createTelegramDomProbe(await load("surface-search-empty.html"));

    expect(await detectSearchState(probe)).toBe("no_results");
  });

  it("fails safely on an unknown UI", async () => {
    const probe = createTelegramDomProbe(await load("surface-ui-changed.html"));

    expect(await detectMainSurface(probe)).toBe("ui_changed");
    expect(await detectChatList(probe)).toEqual({ state: "ui_changed" });
  });

  it("keeps two pages isolated", async () => {
    const first = createTelegramDomProbe(await load("surface-chat-list.html"));
    const second = createTelegramDomProbe(await load("surface-empty-list.html"));

    expect(await detectChatList(first)).toEqual({ state: "ready", itemCount: 2 });
    expect(await detectChatList(second)).toEqual({ state: "empty" });
  });
});
