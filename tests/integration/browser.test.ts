import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserManager } from "../../src/core/browser/browser-manager";
import { createPlaywrightLauncher } from "../../src/core/browser/browser-factory";
import {
  ProxySettingsStore,
  toPlaywrightProxyConfig,
  type SecretCodec,
} from "../../src/core/network/proxy-settings";
import { browserTestPaths } from "./browser-env";
import { startForwardingSocks5Proxy } from "./socks5-proxy";

type Server = { port: number; requests: string[]; close: () => Promise<void> };

function startProxy(
  options: { port?: number; username?: string; password?: string } = {},
): Promise<Server> {
  const requests: string[] = [];
  const expected =
    options.username && options.password
      ? `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`
      : undefined;

  const server = http.createServer((request, response) => {
    requests.push(request.url ?? "");
    if (expected && request.headers["proxy-authorization"] !== expected) {
      response.writeHead(407, { "Proxy-Authenticate": 'Basic realm="test"' });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><body><h1>via proxy</h1></body></html>");
  });

  return new Promise((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        requests,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

/** Reserves a port and releases it so a proxy can start on it later. */
function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

function startTarget(body = "<html><body><h1>direct target</h1></body></html>"): Promise<Server> {
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url ?? "");
    response.writeHead(200, { "content-type": "text/html" });
    response.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        requests,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

function track<T extends Server>(server: T): T {
  cleanups.push(server.close);
  return server;
}

describe("real Chromium", () => {
  it("persists localStorage in a profile across a browser restart", async () => {
    const target = track(await startTarget());
    const launcher = createPlaywrightLauncher();
    const { profileDir, lockPath } = browserTestPaths();

    const first = new BrowserManager({ launcher });
    const firstPage = await first.launch({ profileDir, lockPath });
    await firstPage.goto(`http://127.0.0.1:${target.port}/`);
    await firstPage.evaluate(() => localStorage.setItem("tac-session", "kept"));
    await first.close();

    const second = new BrowserManager({ launcher });
    const secondPage = await second.launch({ profileDir, lockPath });
    await secondPage.goto(`http://127.0.0.1:${target.port}/`);
    expect(await secondPage.evaluate(() => localStorage.getItem("tac-session"))).toBe("kept");
    await second.close();
  });

  it("refuses a second Chromium context for the same profile", async () => {
    const launcher = createPlaywrightLauncher();
    const { profileDir, lockPath } = browserTestPaths();
    const first = new BrowserManager({ launcher });
    await first.launch({ profileDir, lockPath });

    const second = new BrowserManager({ launcher });
    await expect(second.launch({ profileDir, lockPath })).rejects.toThrow("Profile is locked");
    await first.close();
  });

  it("releases the browser process and app lock on close", async () => {
    const launcher = createPlaywrightLauncher();
    const { profileDir, lockPath } = browserTestPaths();
    const manager = new BrowserManager({ launcher });
    const page = await manager.launch({ profileDir, lockPath });
    const browser = page.context().browser();

    await manager.close();

    expect(browser?.isConnected()).toBe(false);
    expect(manager.running).toBe(false);
  });

  it("routes requests through an HTTP proxy with credentials", async () => {
    const proxy = track(await startProxy({ username: "user", password: "secret" }));
    const launcher = createPlaywrightLauncher();
    const { profileDir, lockPath } = browserTestPaths();
    const manager = new BrowserManager({ launcher });
    const page = await manager.launch({
      profileDir,
      lockPath,
      proxy: {
        server: `http://127.0.0.1:${proxy.port}`,
        username: "user",
        password: "secret",
      },
    });

    await page.goto("http://proxy-target.invalid/");

    expect(await page.locator("h1").textContent()).toBe("via proxy");
    expect(proxy.requests).toContain("http://proxy-target.invalid/");
    await manager.close();
  });

  it("navigates through a SOCKS5 proxy", async () => {
    const target = track(await startTarget());
    const socks = await startForwardingSocks5Proxy({ host: "127.0.0.1", port: target.port });
    cleanups.push(socks.close);
    const launcher = createPlaywrightLauncher();
    const { profileDir, lockPath } = browserTestPaths();
    const manager = new BrowserManager({ launcher });
    const page = await manager.launch({
      profileDir,
      lockPath,
      proxy: { server: `socks5://127.0.0.1:${socks.port}` },
    });

    await page.goto("http://socks-target.invalid/");

    expect(await page.locator("h1").textContent()).toBe("direct target");
    expect(manager.running).toBe(true);
    await manager.close();
  });

  it("uses the proxy saved in settings for a persistent Chromium context", async () => {
    const proxy = track(await startProxy());
    const codec: SecretCodec = {
      isAvailable: async () => true,
      encrypt: async (text) => Buffer.from(text, "utf8").toString("base64"),
      decrypt: async (payload) => Buffer.from(payload, "base64").toString("utf8"),
    };
    const { profileDir, lockPath } = browserTestPaths();
    const store = new ProxySettingsStore(path.join(path.dirname(profileDir), "proxy.json"), {
      secrets: codec,
    });
    await store.save({
      enabled: true,
      protocol: "http",
      host: "127.0.0.1",
      port: proxy.port,
      username: "",
    });

    const settings = await store.load();
    expect(settings.enabled).toBe(true);
    const proxyConfig = toPlaywrightProxyConfig(settings);
    if (!proxyConfig) throw new Error("The saved proxy did not reach Playwright");

    const manager = new BrowserManager({ launcher: createPlaywrightLauncher() });
    const page = await manager.launch({ profileDir, lockPath, proxy: proxyConfig });
    await page.goto("http://saved-settings.invalid/");

    expect(await page.locator("h1").textContent()).toBe("via proxy");
    expect(proxy.requests).toContain("http://saved-settings.invalid/");
    await manager.close();
  });

  it("honors the bypass list", async () => {
    const proxy = track(await startProxy());
    const target = track(await startTarget());
    const launcher = createPlaywrightLauncher();
    const { profileDir, lockPath } = browserTestPaths();
    const manager = new BrowserManager({ launcher });
    const page = await manager.launch({
      profileDir,
      lockPath,
      proxy: {
        server: `http://127.0.0.1:${proxy.port}`,
        bypass: "127.0.0.1,localhost",
      },
    });

    await page.goto(`http://127.0.0.1:${target.port}/`);

    expect(await page.locator("h1").textContent()).toBe("direct target");
    expect(proxy.requests).toHaveLength(0);
    await manager.close();
  });

  it("replaces a stale lock and keeps the profile intact", async () => {
    const { profileDir, lockPath } = browserTestPaths();
    fs.mkdirSync(profileDir, { recursive: true });
    const sentinel = path.join(profileDir, "session-sentinel.txt");
    fs.writeFileSync(sentinel, "keep-me");
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ pid: 999_999, createdAt: new Date(0).toISOString() }),
    );

    const manager = new BrowserManager({ launcher: createPlaywrightLauncher() });
    await manager.launch({ profileDir, lockPath });

    expect(fs.existsSync(sentinel)).toBe(true);
    expect(fs.readFileSync(sentinel, "utf8")).toBe("keep-me");
    expect((JSON.parse(fs.readFileSync(lockPath, "utf8")) as { pid: number }).pid).toBe(
      process.pid,
    );
    await manager.close();
  });

  it("fails while the proxy is down and recovers when it returns", async () => {
    const port = await reservePort();
    const { profileDir, lockPath } = browserTestPaths();
    const manager = new BrowserManager({ launcher: createPlaywrightLauncher() });
    const page = await manager.launch({
      profileDir,
      lockPath,
      proxy: { server: `http://127.0.0.1:${port}` },
    });

    await expect(page.goto("http://proxy-target.invalid/")).rejects.toThrow();
    expect(manager.running).toBe(true);
    expect(page.isClosed()).toBe(false);

    const proxy = track(await startProxy({ port }));
    // Use a fresh page: the failed navigation is still settling on chrome-error.
    const recovered = await page.context().newPage();
    await recovered.goto("http://proxy-target.invalid/");

    expect(await recovered.locator("h1").textContent()).toBe("via proxy");
    expect(proxy.requests).toContain("http://proxy-target.invalid/");
    await manager.close();
  });
});
