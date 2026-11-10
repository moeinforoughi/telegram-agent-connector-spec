import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlaywrightProbe, detectLoginState } from "../../src/core/telegram/login-detector";
import { browserTestPaths } from "./browser-env";

const fixture = (name: string): string =>
  fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "telegram", name), "utf8");

let browser: Browser;

beforeAll(async () => {
  browserTestPaths();
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
});

describe("login detection against local fixtures", () => {
  it("detects the login page and QR", async () => {
    const page = await browser.newPage();
    await page.setContent(fixture("login.html"));
    const detection = await detectLoginState(createPlaywrightProbe(page));

    expect(detection.state).toBe("LOGIN_REQUIRED");
    expect(detection.evidence.some((entry) => entry.includes("auth"))).toBe(true);
    await page.close();
  });

  it("detects a connected account with visible chats", async () => {
    const page = await browser.newPage();
    await page.setContent(fixture("connected.html"));
    const detection = await detectLoginState(createPlaywrightProbe(page));

    expect(detection.state).toBe("CONNECTED");
    expect(detection.evidence).toContain("chatItems:#chatlist-container .chatlist-chat:3");
    await page.close();
  });

  it("ignores elements hidden by display or the hidden attribute", async () => {
    const page = await browser.newPage();
    await page.setContent(fixture("hidden.html"));
    const detection = await detectLoginState(createPlaywrightProbe(page));

    expect(detection.state).toBe("UNKNOWN");
    await page.close();
  });

  it("reports unknown for an unrecognized UI", async () => {
    const page = await browser.newPage();
    await page.setContent(fixture("ui-changed.html"));

    expect((await detectLoginState(createPlaywrightProbe(page))).state).toBe("UNKNOWN");
    await page.close();
  });
});
