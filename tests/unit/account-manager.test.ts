import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountStore } from "../../src/core/account/account-store";
import type { ProxySettings } from "../../src/core/network/proxy-settings";
import { AccountManager } from "../../src/main/account-manager";
import type { BrowserDriver } from "../../src/main/account-controller";
import type { AccountView } from "../../src/shared/account";
import type { LoginDetection } from "../../src/core/telegram/telegram-types";

let root: string;
let store: AccountStore;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-manager-"));
  let index = 0;
  store = new AccountStore(
    path.join(root, "config", "accounts.json"),
    path.join(root, "profiles"),
    {
      id: () => `1111111${index++}-2222-3333-4444-555555555555`,
    },
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function page(): Page {
  return {
    goto: vi.fn(async () => undefined),
    url: () => "https://web.telegram.org/k/",
    isClosed: () => false,
    bringToFront: vi.fn(async () => undefined),
  } as unknown as Page;
}

function browser(p = page()): BrowserDriver & {
  readonly p: Page;
  triggerClosed: () => void;
} {
  let running = false;
  let onClosed: (() => void) | undefined;
  return {
    get page() {
      return running ? p : undefined;
    },
    launch: vi.fn(async () => {
      running = true;
      return p;
    }),
    close: vi.fn(async () => {
      running = false;
    }),
    get running() {
      return running;
    },
    p,
    triggerClosed: () => onClosed?.(),
    setOnClosed: (callback: () => void) => {
      onClosed = callback;
    },
  } as unknown as BrowserDriver & {
    readonly p: Page;
    triggerClosed: () => void;
    setOnClosed: (callback: () => void) => void;
  };
}

const direct: ProxySettings = {
  enabled: false,
  protocol: "socks5",
  host: "127.0.0.1",
  port: 10808,
  username: "",
  password: "",
};

function connected(): LoginDetection {
  return { state: "CONNECTED", evidence: [] };
}

function manager(maxActive = 3) {
  const browsers: Array<ReturnType<typeof browser>> = [];
  const views: AccountView[] = [];
  const subject = new AccountManager({
    store,
    createBrowser: (onClosed) => {
      const driver = browser();
      const withHook = driver as unknown as { setOnClosed: (callback: () => void) => void };
      withHook.setOnClosed(onClosed);
      browsers.push(driver);
      return driver;
    },
    getProxySettings: async () => direct,
    createProbe: () => ({ url: () => "", isVisible: async () => false, count: async () => 0 }),
    monitor: async () => connected(),
    maxActive,
    onView: (view) => views.push(view),
    log: () => undefined,
  });
  return { subject, browsers, views };
}

describe("AccountManager", () => {
  it("creates and lists multiple accounts lazily", () => {
    const { subject, browsers } = manager();

    const first = subject.create("Personal");
    const second = subject.create("Work");
    const third = subject.create("Test");

    expect(subject.list().map((account) => account.label)).toEqual(["Personal", "Work", "Test"]);
    expect(new Set(subject.list().map((account) => account.id)).size).toBe(3);
    expect(subject.list().map((account) => account.id)).toEqual([first.id, second.id, third.id]);
    expect(browsers).toHaveLength(0);
  });

  it("keeps account status isolated", async () => {
    const { subject } = manager();
    const first = subject.create("One");
    const second = subject.create("Two");
    if (!first.id || !second.id) throw new Error("Missing ids");

    await subject.start(first.id);
    await vi.waitFor(() => {
      expect(subject.list().find((account) => account.id === first.id)?.status).toBe("connected");
    });

    expect(subject.list().find((account) => account.id === second.id)?.status).toBe("disconnected");
  });

  it("enforces the max active browser limit and recovers after stop", async () => {
    const { subject } = manager(2);
    const first = subject.create("One");
    const second = subject.create("Two");
    const third = subject.create("Three");
    if (!first.id || !second.id || !third.id) throw new Error("Missing ids");

    await subject.start(first.id);
    await subject.start(second.id);
    await expect(subject.start(third.id)).rejects.toThrow(/At most 2 browsers/);

    await subject.stop(first.id);
    await subject.start(third.id);
    await vi.waitFor(() => {
      expect(subject.list().find((account) => account.id === third.id)?.status).toBe("connected");
    });
  });

  it("keeps other accounts unaffected when one browser is closed", async () => {
    const { subject, browsers } = manager();
    const first = subject.create("One");
    const second = subject.create("Two");
    if (!first.id || !second.id) throw new Error("Missing ids");

    await subject.start(first.id);
    await subject.start(second.id);
    await vi.waitFor(() => {
      expect(subject.list().find((account) => account.id === first.id)?.status).toBe("connected");
      expect(subject.list().find((account) => account.id === second.id)?.status).toBe("connected");
    });

    const firstBrowser = browsers[0];
    if (!firstBrowser) throw new Error("Missing first browser");
    await firstBrowser.close();
    firstBrowser.triggerClosed();

    expect(subject.list().find((account) => account.id === first.id)?.status).toBe("ready");
    expect(subject.list().find((account) => account.id === second.id)?.status).toBe("connected");

    const firstProfile = store.getById(first.id)?.profileDir;
    const secondProfile = store.getById(second.id)?.profileDir;
    expect(firstProfile).not.toBe(secondProfile);
    expect(firstProfile && fs.existsSync(firstProfile)).toBe(true);
    expect(secondProfile && fs.existsSync(secondProfile)).toBe(true);
    expect(browsers).toHaveLength(2);
  });

  it("removes one account without touching the others", async () => {
    const { subject } = manager();
    const first = subject.create("One");
    const second = subject.create("Two");
    if (!first.id || !second.id) throw new Error("Missing ids");
    const firstProfile = store.getById(first.id)?.profileDir;
    const secondProfile = store.getById(second.id)?.profileDir;

    await subject.remove(first.id, true);

    expect(subject.list().map((account) => account.id)).toEqual([second.id]);
    expect(firstProfile && fs.existsSync(firstProfile)).toBe(false);
    expect(secondProfile && fs.existsSync(secondProfile)).toBe(true);
  });

  it("renames an account and rejects unknown ids", () => {
    const { subject } = manager();
    const account = subject.create("Old");

    expect(subject.rename(account.id ?? "", "New").label).toBe("New");
    expect(subject.list()[0]?.label).toBe("New");
    expect(() => subject.rename("missing", "x")).toThrow(/not found/);
  });

  it("serializes concurrent starts for the same account", async () => {
    const { subject, browsers } = manager();
    const account = subject.create("One");
    if (!account.id) throw new Error("Missing id");

    await Promise.all([subject.start(account.id), subject.start(account.id)]);

    expect(browsers).toHaveLength(1);
    expect(browsers[0]?.launch).toHaveBeenCalledTimes(1);
  });

  it("stops all running browsers on shutdown", async () => {
    const { subject, browsers } = manager();
    const first = subject.create("One");
    const second = subject.create("Two");
    if (!first.id || !second.id) throw new Error("Missing ids");

    await subject.start(first.id);
    await subject.start(second.id);
    expect(subject.activeBrowserCount).toBe(2);

    await subject.shutdown();
    expect(subject.activeBrowserCount).toBe(0);
    for (const driver of browsers) expect(driver.close).toHaveBeenCalled();
  });
});
