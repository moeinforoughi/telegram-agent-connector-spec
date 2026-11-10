import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron, type ElectronApplication, type Page } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import { APP_NAME } from "../../src/shared/constants";

const projectRoot = process.cwd();
const packageVersion = (
  JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")) as { version: string }
).version;

let app: ElectronApplication | undefined;
let page: Page | undefined;
let userDataDir: string | undefined;

async function launchApp(
  existingUserDataDir?: string,
): Promise<{ app: ElectronApplication; page: Page }> {
  userDataDir = existingUserDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "tac-e2e-"));
  const launched = await electron.launch({
    args: [projectRoot],
    cwd: projectRoot,
    env: launchEnv(userDataDir),
  });
  app = launched;
  page = await launched.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app: launched, page };
}

function launchEnv(userDataDir: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.CONNECTOR_USER_DATA_DIR = userDataDir;
  env.NODE_ENV = "test";

  const browsersPath = path.join(projectRoot, "spike", ".browsers");
  if (!env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browsersPath)) {
    env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
  }

  // Electron must boot as Electron, not as plain Node. The DSH shell exports
  // this for its own tooling; it must never leak into the launched app.
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
  page = undefined;

  if (userDataDir) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    userDataDir = undefined;
  }
});

describe("Electron shell", () => {
  it("loads the renderer with the product shell", async () => {
    const launched = await launchApp();

    expect(await launched.page.title()).toBe(APP_NAME);
    expect(await launched.page.locator("h1").textContent()).toBe(APP_NAME);
  });

  it("hardens the renderer and exposes only the preload API", async () => {
    const launched = await launchApp();

    // Electron 45 no longer exposes getLastWebPreferences; the construction
    // options are unit-tested and the runtime isolation is asserted here.
    const renderer = await launched.page.evaluate(() => {
      const globals = globalThis as unknown as Record<string, unknown>;
      const api = (globals.api as Record<string, unknown> | undefined) ?? {};
      return {
        require: typeof globals.require,
        process: typeof globals.process,
        Buffer: typeof globals.Buffer,
        module: typeof globals.module,
        apiKeys: Object.keys(api),
        hasIpcRenderer: "ipcRenderer" in api,
      };
    });

    expect(renderer.require).toBe("undefined");
    expect(renderer.process).toBe("undefined");
    expect(renderer.Buffer).toBe("undefined");
    expect(renderer.module).toBe("undefined");
    expect(renderer.apiKeys).toEqual([
      "getAppInfo",
      "getAccount",
      "startAccount",
      "stopAccount",
      "openTelegram",
      "removeAccount",
      "getProxySettings",
      "saveProxySettings",
      "testProxy",
      "onAccountStatus",
    ]);
    expect(renderer.hasIpcRenderer).toBe(false);
  });

  it("serves app info through the allowlisted IPC channel and uses the test data path", async () => {
    const launched = await launchApp();

    const result = await launched.page.evaluate(() =>
      (globalThis as unknown as { api: { getAppInfo(): Promise<unknown> } }).api.getAppInfo(),
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        appName: APP_NAME,
        appVersion: packageVersion,
        platform: process.platform,
      },
    });

    const dataRoot = userDataDir;
    if (!dataRoot) {
      throw new Error("Missing test data directory");
    }
    const actualRoot = await launched.app.evaluate(({ app: electronApp }) =>
      electronApp.getPath("userData"),
    );
    expect(actualRoot).toBe(dataRoot);
    for (const directory of ["config", "profiles", "logs", "cache", "backups"]) {
      expect(fs.existsSync(path.join(dataRoot, directory))).toBe(true);
    }
  });

  it("shows the single-account dashboard without exposing local paths", async () => {
    const launched = await launchApp();

    const account = await launched.page.evaluate(() =>
      (globalThis as unknown as { api: { getAccount(): Promise<unknown> } }).api.getAccount(),
    );

    expect(account).toEqual({
      ok: true,
      data: { id: null, label: "No account", status: "disconnected" },
    });
    expect(JSON.stringify(account)).not.toContain(userDataDir);
    expect(await launched.page.locator("#status-heading").textContent()).toBe(
      "No account connected",
    );
    expect(await launched.page.getByRole("button", { name: "Add Account" }).count()).toBe(1);
  });

  it("shows editable manual proxy settings", async () => {
    const launched = await launchApp();

    await expect
      .poll(() => launched.page.getByLabel("Host / IP").inputValue(), { timeout: 5_000 })
      .toBe("127.0.0.1");
    expect(await launched.page.getByLabel("Port").inputValue()).toBe("10808");
    expect(await launched.page.getByLabel("Protocol").inputValue()).toBe("socks5");
    expect(await launched.page.getByLabel("Enable proxy").isChecked()).toBe(false);
    expect(await launched.page.getByRole("button", { name: "Test Proxy" }).count()).toBe(1);
    expect(await launched.page.getByRole("button", { name: "Save Settings" }).count()).toBe(1);
  });

  it("saves the Enable proxy toggle immediately through the UI", async () => {
    const launched = await launchApp();

    const toggle = launched.page.getByLabel("Enable proxy");
    await expect.poll(() => toggle.isChecked(), { timeout: 5_000 }).toBe(false);
    await toggle.check();
    expect(await toggle.isChecked()).toBe(true);

    const dataRoot = userDataDir;
    if (!dataRoot) throw new Error("Missing test data directory");
    const settingsFile = path.join(dataRoot, "config", "proxy.json");

    // No Save click: enabling the proxy must persist by itself.
    await expect
      .poll(
        () => {
          try {
            const raw = JSON.parse(fs.readFileSync(settingsFile, "utf8")) as {
              enabled?: boolean;
            };
            return raw.enabled;
          } catch {
            return undefined;
          }
        },
        { timeout: 5_000 },
      )
      .toBe(true);

    const raw = JSON.parse(fs.readFileSync(settingsFile, "utf8")) as {
      enabled: boolean;
      host: string;
      port: number;
    };
    expect(raw).toMatchObject({ enabled: true, host: "127.0.0.1", port: 10808 });
  });

  it("persists proxy settings and never writes credentials in plain text", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tac-e2e-proxy-"));
    const first = await launchApp(dir);

    const saved = await first.page.evaluate(() =>
      (
        globalThis as unknown as {
          api: {
            saveProxySettings(request: unknown): Promise<{
              ok: boolean;
              data?: { hasPassword: boolean; secureStorageAvailable: boolean };
            }>;
          };
        }
      ).api.saveProxySettings({
        enabled: true,
        protocol: "socks5",
        host: "127.0.0.1",
        port: 10808,
        username: "proxy-user",
        password: "proxy-secret",
      }),
    );

    expect(saved.ok).toBe(true);
    const savedView = saved.data;
    if (!savedView) throw new Error("Missing proxy view");
    expect(savedView).toMatchObject({ hasPassword: savedView.secureStorageAvailable });
    expect(JSON.stringify(saved)).not.toContain("proxy-secret");

    const raw = fs.readFileSync(path.join(dir, "config", "proxy.json"), "utf8");
    expect(raw).not.toContain("proxy-secret");
    expect(raw).not.toContain("proxy-user");
    expect(raw).toContain("127.0.0.1");

    await first.app.close();
    app = undefined;

    const second = await launchApp(dir);
    const reloaded = await second.page.evaluate(() =>
      (
        globalThis as unknown as {
          api: {
            getProxySettings(): Promise<{
              ok: boolean;
              data?: {
                enabled: boolean;
                protocol: string;
                host: string;
                port: number;
                hasPassword: boolean;
              };
            }>;
          };
        }
      ).api.getProxySettings(),
    );

    expect(reloaded.ok).toBe(true);
    expect(reloaded.data).toMatchObject({
      enabled: true,
      protocol: "socks5",
      host: "127.0.0.1",
      port: 10808,
      hasPassword: savedView.secureStorageAvailable,
    });
  });

  it("loads Playwright and launches a browser from the Electron main process", async () => {
    const launched = await launchApp();

    const heading = await launched.app.evaluate(async ({ app: electronApp }) => {
      // Playwright is externalized by electron-vite, so Main resolves it from
      // the app root. app.evaluate has no dynamic import callback, hence the
      // absolute require through the Electron main module.
      type PlaywrightModule = {
        chromium: {
          launch(options: { headless: boolean }): Promise<{
            newPage(): Promise<{
              setContent(html: string): Promise<void>;
              locator(selector: string): { textContent(): Promise<string | null> };
            }>;
            close(): Promise<void>;
          }>;
        };
      };

      const mainModule = process.mainModule;
      if (!mainModule) throw new Error("Electron main module is unavailable");
      const playwrightPath = `${electronApp.getAppPath()}/node_modules/playwright`;
      const { chromium } = mainModule.require(playwrightPath) as PlaywrightModule;

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent("<h1>electron-main-playwright</h1>");
        return await page.locator("h1").textContent();
      } finally {
        await browser.close();
      }
    });

    expect(heading).toBe("electron-main-playwright");
  });

  it("blocks remote navigation and new windows", async () => {
    const launched = await launchApp();
    const originalUrl = launched.page.url();
    const windowCount = launched.app.windows().length;

    await launched.page.evaluate(() => {
      window.open("https://example.com");
    });
    await expect
      .poll(() => launched.app.windows().length, { timeout: 2_000, interval: 100 })
      .toBe(windowCount);

    await launched.page
      .evaluate(() => {
        window.location.href = "https://example.com";
      })
      .catch(() => undefined);
    await expect
      .poll(() => launched.page.url(), { timeout: 2_000, interval: 100 })
      .toBe(originalUrl);
  });

  it("uses a strict production CSP", async () => {
    const launched = await launchApp();

    const content = await launched.page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");

    expect(content).toContain("script-src 'self'");
    expect(content).not.toContain("'unsafe-inline'");
    expect(content).toContain("connect-src 'none'");
    expect(content).not.toContain("frame-ancestors");
  });

  it("exits the main process when its last window closes", async () => {
    const launched = await launchApp();
    const child = launched.app.process();

    await launched.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await expect.poll(() => child.exitCode, { timeout: 5_000, interval: 100 }).not.toBeNull();

    app = undefined;
  });
});
