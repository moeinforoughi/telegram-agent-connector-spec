import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserManager } from "../../src/core/browser/browser-manager";
import { createPlaywrightLauncher } from "../../src/core/browser/browser-factory";
import { browserTestPaths } from "./browser-env";

type Server = { port: number; requests: string[]; close: () => Promise<void> };

function startProxy(options: { username?: string; password?: string } = {}): Promise<Server> {
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
});
