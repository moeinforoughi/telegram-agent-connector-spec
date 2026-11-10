import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Page } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountController } from "../../src/main/account-controller";
import { AccountStore } from "../../src/core/account/account-store";
import type { AccountView } from "../../src/shared/account";
import { AppError } from "../../src/shared/errors";
import type { ProxySettings } from "../../src/core/network/proxy-settings";
import type { LoginDetection } from "../../src/core/telegram/telegram-types";

let root: string;
let profilesRoot: string;
let store: AccountStore;
let accountId: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-controller-"));
  profilesRoot = path.join(root, "profiles");
  store = new AccountStore(path.join(root, "config", "accounts.json"), profilesRoot, {
    now: () => new Date("2026-11-10T10:00:00.000Z"),
    id: () => "11111111-2222-3333-4444-555555555555",
  });
  accountId = store.create().id;
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

const direct: ProxySettings = {
  enabled: false,
  protocol: "socks5",
  host: "127.0.0.1",
  port: 10808,
  username: "",
  password: "",
};
const proxied: ProxySettings = { ...direct, enabled: true };

function connected(): LoginDetection {
  return { state: "CONNECTED", evidence: ["visible:#column-left"] };
}

function controller(
  browserDriver: ReturnType<typeof browser>,
  options: {
    proxy?: ProxySettings;
    getProxySettings?: () => Promise<ProxySettings>;
    monitor?: (options: unknown) => Promise<LoginDetection>;
    views?: AccountView[];
    log?: (message: string) => void;
  } = {},
): AccountController {
  return new AccountController({
    store,
    browser: browserDriver,
    accountId,
    getProxySettings: options.getProxySettings ?? (async () => options.proxy ?? direct),
    createProbe: () => ({
      url: () => "https://web.telegram.org/k/",
      isVisible: async () => false,
      count: async () => 0,
    }),
    monitor: async (monitorOptions) =>
      options.monitor ? options.monitor(monitorOptions) : connected(),
    onView: (view) => options.views?.push(view),
    now: () => new Date("2026-11-10T10:00:00.000Z"),
    log: options.log ?? (() => undefined),
  });
}

describe("AccountController", () => {
  it("starts the stored account, launches the browser, and becomes connected", async () => {
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
      expect.objectContaining({ proxy: { server: "socks5://127.0.0.1:10808" } }),
    );
  });

  it("maps an invalid proxy configuration to PROXY_ERROR without launching", async () => {
    const driver = browser();
    const subject = new AccountController({
      store,
      browser: driver,
      accountId,
      getProxySettings: async () => {
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

  it("keeps the browser open after a navigation error and retries in place", async () => {
    const driver = browser();
    const goto = vi.fn(async () => {
      throw new Error("net::ERR_PROXY_CONNECTION_FAILED");
    });
    driver.p.goto = goto;
    const subject = controller(driver, { proxy: proxied });

    await subject.start();

    expect(subject.getView().error?.code).toBe("PROXY_ERROR");
    expect(driver.running).toBe(true);
    expect(driver.launch).toHaveBeenCalledTimes(1);
    expect(driver.close).not.toHaveBeenCalled();

    goto.mockImplementation(async () => undefined as never);
    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));

    expect(driver.launch).toHaveBeenCalledTimes(1);
    expect(driver.close).not.toHaveBeenCalled();
  });

  it("relaunches with the new proxy after the settings change", async () => {
    const driver = browser();
    const goto = vi.fn(async () => {
      throw new Error("net::ERR_PROXY_CONNECTION_FAILED");
    });
    driver.p.goto = goto;
    let settings: ProxySettings = { ...proxied, protocol: "http", port: 8080 };
    const subject = controller(driver, { getProxySettings: async () => settings });

    await subject.start();
    expect(subject.getView().status).toBe("error");

    settings = { ...proxied, protocol: "socks5", port: 10809 };
    goto.mockImplementation(async () => undefined as never);
    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));

    expect(driver.close).toHaveBeenCalledTimes(1);
    expect(driver.launch).toHaveBeenCalledTimes(2);
    expect(driver.launch).toHaveBeenLastCalledWith(
      expect.objectContaining({ proxy: { server: "socks5://127.0.0.1:10809" } }),
    );
  });

  it("logs proxy routing metadata without credentials", async () => {
    const driver = browser();
    const logs: string[] = [];
    const settings: ProxySettings = {
      ...proxied,
      username: "proxy-user",
      password: "proxy-secret",
    };
    const subject = controller(driver, { proxy: settings, log: (message) => logs.push(message) });

    await subject.start();

    expect(logs).toEqual(
      expect.arrayContaining([
        "starting browser",
        "proxy.enabled=true",
        "proxy.protocol=socks5",
        "proxy.host=127.0.0.1",
        "proxy.port=10808",
        "mode=proxy",
      ]),
    );
    expect(logs.join("\n")).not.toContain("proxy-secret");
    expect(logs.join("\n")).not.toContain("proxy-user");
  });

  it("fails closed when the proxy is enabled but unusable", async () => {
    const driver = browser();
    const invalid: ProxySettings = {
      enabled: true,
      protocol: "socks5",
      host: "",
      port: 0,
      username: "",
      password: "",
    };
    const subject = controller(driver, { proxy: invalid });

    await subject.start();

    expect(subject.getView().error?.code).toBe("PROXY_ERROR");
    expect(driver.launch).not.toHaveBeenCalled();
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

  it("marks a user-closed browser as ready and keeps the last known session", async () => {
    const driver = browser();
    const subject = controller(driver);
    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));
    const profileDir = store.getFirst()?.profileDir;

    await driver.close();
    subject.handleBrowserClosed();

    expect(subject.getView().status).toBe("ready");
    expect(subject.getView().loginState).toBe("CONNECTED");
    expect(subject.getView().error).toBeUndefined();
    expect(profileDir && fs.existsSync(profileDir)).toBe(true);

    await subject.start();
    await vi.waitFor(() => expect(subject.getView().status).toBe("connected"));

    expect(driver.launch).toHaveBeenCalledTimes(2);
    expect(driver.launch).toHaveBeenLastCalledWith(expect.objectContaining({ profileDir }));
    expect(profileDir && fs.existsSync(profileDir)).toBe(true);
  });
});
