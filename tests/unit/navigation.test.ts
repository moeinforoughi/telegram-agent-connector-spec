import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";
import {
  isTelegramWebUrl,
  openTelegram,
  TELEGRAM_WEB_URL,
} from "../../src/core/telegram/navigation";

describe("isTelegramWebUrl", () => {
  it("accepts WebZ paths only", () => {
    expect(isTelegramWebUrl("https://web.telegram.org/k/")).toBe(true);
    expect(isTelegramWebUrl("https://web.telegram.org/k/#@user")).toBe(true);
    expect(isTelegramWebUrl("https://web.telegram.org/k")).toBe(true);
  });

  it("rejects WebA, plain HTTP, and other hosts", () => {
    expect(isTelegramWebUrl("https://web.telegram.org/a/")).toBe(false);
    expect(isTelegramWebUrl("http://web.telegram.org/k/")).toBe(false);
    expect(isTelegramWebUrl("https://web.telegram.org/")).toBe(false);
    expect(isTelegramWebUrl("https://evil.example/k/")).toBe(false);
    expect(isTelegramWebUrl("not a url")).toBe(false);
  });
});

describe("openTelegram", () => {
  it("navigates to WebZ and returns the final URL", async () => {
    const page = {
      goto: vi.fn(async () => undefined),
      url: () => "https://web.telegram.org/k/",
    } as unknown as Page;

    await expect(openTelegram(page)).resolves.toBe("https://web.telegram.org/k/");
    expect(page.goto).toHaveBeenCalledWith(TELEGRAM_WEB_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  });

  it("maps a navigation failure to NETWORK_ERROR", async () => {
    const page = {
      goto: vi.fn(async () => {
        throw new Error("net::ERR_PROXY_CONNECTION_FAILED");
      }),
      url: () => "about:blank",
    } as unknown as Page;

    await expect(openTelegram(page)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Could not open Telegram Web",
    });
  });

  it("maps an unexpected redirect to TELEGRAM_UI_CHANGED", async () => {
    const page = {
      goto: vi.fn(async () => undefined),
      url: () => "https://web.telegram.org/a/",
    } as unknown as Page;

    await expect(openTelegram(page)).rejects.toMatchObject({ code: "TELEGRAM_UI_CHANGED" });
  });
});
