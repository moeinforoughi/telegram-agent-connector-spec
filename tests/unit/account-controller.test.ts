import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountController } from "../../src/main/account-controller";
import { AccountStore } from "../../src/core/account/account-store";
import type { AccountView } from "../../src/shared/account";
import { AppError } from "../../src/shared/errors";
import type { ProxyResolution } from "../../src/core/network/proxy-resolver";
import type { LoginDetection } from "../../src/core/telegram/telegram-types";

let root: string;
let profilesRoot: string;
let store: AccountStore;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-controller-"));
  profilesRoot = path.join(root, "profiles");
  store = new AccountStore(path.join(root, "config", "accounts.json"), profilesRoot, {
    now: () => new Date("2026-11-10T10:00:00.000Z"),
    id: () => "11111111-2222-3333-4444-555555555555",
  });
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

function browser(p = page()) {
  let running = false;
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
  };
}

const direct: ProxyResolution = { source: "direct", mode: "direct", requiresAuthentication: false };
const proxied: ProxyResolution = {
  source: "manual",
  mode: "proxy",
  server: "http://127.0.0.1:8080",
  requiresAuthentication: false,
};

function connected(): LoginDetection {
  return { state: "CONNECTED", evidence: ["visible:#column-left"] };
}

function controller(
  browserDriver: ReturnType<typeof browser>,
  options: {
    proxy?: ProxyResolution;
    monitor?: (options: unknown) => Promise<LoginDetection>;
    views?: AccountView[];
  } = {},
): AccountController {
  return new AccountController({
    store,
    browser: browserDriver,
    resolveProxy: () => options.proxy ?? direct,
    createProbe: () => ({
      url: () => "https://web.telegram.org/k/",
      isVisible: async () => false,
      count: async () => 0,
    }),
    monitor: async (monitorOptions) =>
      options.monitor ? options.monitor(monitorOptions) : connected(),
    onView: (view) => options.views?.push(view),
    now: () => new Date("2026-11-10T10:00:00.000Z"),
    log: () => undefined,
  });
}

describe("AccountController", () => {
  it("creates an account, launches the browser, and becomes connected", async () => {
    const driver = browser();
    const views: AccountView[] = [];
    const subject = controller(driver, { views });

    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));

    expect(driver.launch).toHaveBeenCalledTimes(1);
    expect(store.getFirst()?.lastConnectedAt).toBe("2026-11-10T10:00:00.000Z");
    expect(subject.getView()).toMatchObject({
      id: "11111111-2222-3333-4444-555555555555",
      label: "Account 1",
      status: "connected",
      loginState: "CONNECTED",
    });
    expect(JSON.stringify(subject.getView())).not.toContain(profilesRoot);
    expect(views.some((view) => view.status === "initializing")).toBe(true);
  });

  it("passes the resolved proxy to the browser", async () => {
    const driver = browser();
    const subject = controller(driver, { proxy: proxied });

    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));

    expect(driver.launch).toHaveBeenCalledWith(
      expect.objectContaining({ proxy: { server: "http://127.0.0.1:8080" } }),
    );
  });

  it("maps a proxy resolution failure to PROXY_ERROR", async () => {
    const driver = browser();
    const subject = new AccountController({
      store,
      browser: driver,
      resolveProxy: () => {
        throw new AppError("PROXY_ERROR", "Invalid proxy server");
      },
      createProbe: () => ({ url: () => "", isVisible: async () => false, count: async () => 0 }),
      monitor: async () => connected(),
      onView: () => undefined,
      log: () => undefined,
    });

    await subject.start();

    expect(subject.getView().status).toBe("error");
    expect(subject.getView().error?.code).toBe("PROXY_ERROR");
    expect(driver.launch).not.toHaveBeenCalled();
  });

  it("reports PROXY_ERROR when Telegram cannot be reached through the proxy", async () => {
    const driver = browser();
    driver.p.goto = vi.fn(async () => {
      throw new Error("net::ERR_PROXY_CONNECTION_FAILED");
    });
    const subject = controller(driver, { proxy: proxied });

    await subject.start();

    expect(subject.getView().error).toMatchObject({ code: "PROXY_ERROR" });
  });

  it("does not launch twice while running", async () => {
    const driver = browser();
    const subject = controller(driver);
    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));

    await subject.openTelegram();

    expect(driver.launch).toHaveBeenCalledTimes(1);
    expect(driver.p.bringToFront).toHaveBeenCalledTimes(1);
  });

  it("stops the browser and marks the account disconnected", async () => {
    const driver = browser();
    const subject = controller(driver);
    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));

    await subject.stop();

    expect(driver.close).toHaveBeenCalledTimes(1);
    expect(subject.getView().status).toBe("disconnected");
    expect(subject.getView().loginState).toBeUndefined();
    expect(subject.getView().error).toBeUndefined();
  });

  it("reports a browser closed by the user as an error", async () => {
    const driver = browser();
    const subject = controller(driver);
    await subject.start();

    subject.handleBrowserClosed();

    expect(subject.getView().status).toBe("error");
    expect(subject.getView().error?.code).toBe("BROWSER_CLOSED");
  });

  it("removes metadata without deleting the profile by default", async () => {
    const driver = browser();
    const subject = controller(driver);
    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));
    const profileDir = store.getFirst()?.profileDir;

    await subject.remove(false);

    expect(store.load()).toEqual([]);
    expect(profileDir && fs.existsSync(profileDir)).toBe(true);
    expect(subject.getView().id).toBeNull();
  });

  it("deletes the profile only when explicitly confirmed", async () => {
    const driver = browser();
    const subject = controller(driver);
    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));
    const profileDir = store.getFirst()?.profileDir;

    await subject.remove(true);

    expect(profileDir && fs.existsSync(profileDir)).toBe(false);
    expect(store.load()).toEqual([]);
  });
});
