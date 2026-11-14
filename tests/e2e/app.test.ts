import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { _electron as electron, type ElectronApplication, type Page } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import { APP_NAME } from "../../src/shared/constants";

const projectRoot = process.cwd();
const playwrightModuleUrl = pathToFileURL(
  path.join(projectRoot, "node_modules/playwright/index.mjs"),
).href;
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
      "listAccounts",
      "createAccount",
      "renameAccount",
      "startAccount",
      "stopAccount",
      "openTelegram",
      "removeAccount",
      "getProxySettings",
      "saveProxySettings",
      "testProxy",
      "getAccountStatus",
      "getChatList",
      "searchChats",
      "resolveRecipient",
      "selectRecipient",
      "getChatMessages",
      "getUiHealth",
      "prepareSend",
      "prepareReply",
      "confirmMessage",
      "cancelMessage",
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

  it("shows the multi-account dashboard without exposing local paths", async () => {
    const launched = await launchApp();

    const accounts = await launched.page.evaluate(() =>
      (globalThis as unknown as { api: { listAccounts(): Promise<unknown> } }).api.listAccounts(),
    );

    expect(accounts).toEqual({ ok: true, data: [] });
    expect(JSON.stringify(accounts)).not.toContain(userDataDir);
    expect(await launched.page.locator("#accounts-heading").textContent()).toBe("Accounts");
    expect(await launched.page.getByText("No accounts yet.").count()).toBe(1);
    expect(await launched.page.getByRole("button", { name: "Add Account" }).count()).toBe(1);
  });

  it("creates an account from the dashboard without launching a browser", async () => {
    const launched = await launchApp();

    await launched.page.getByLabel("New account label").fill("Personal");
    await launched.page.getByRole("button", { name: "Add Account" }).click();

    await expect
      .poll(() => launched.page.getByRole("heading", { name: "Personal" }).count(), {
        timeout: 5_000,
      })
      .toBe(1);

    const dataRoot = userDataDir;
    if (!dataRoot) throw new Error("Missing test data directory");
    const raw = JSON.parse(
      fs.readFileSync(path.join(dataRoot, "config", "accounts.json"), "utf8"),
    ) as Array<{
      label: string;
      profileDir: string;
    }>;
    expect(raw).toHaveLength(1);
    expect(raw[0]?.label).toBe("Personal");
    expect(raw[0]?.profileDir).toContain("profiles");
    expect(fs.existsSync(path.join(dataRoot, "profiles"))).toBe(true);
  });

  it("shows account-scoped diagnostics without opening a browser", async () => {
    const { page } = await launchApp();
    await page.getByLabel("New account label").fill("Diagnostic account");
    await page.getByRole("button", { name: "Add Account" }).click();
    await page.getByText("Telegram diagnostics", { exact: true }).click();
    await page.getByRole("button", { name: "Account status" }).click();
    const output = page.locator(".telegram-result");
    await expect.poll(() => output.textContent()).toContain('"status": "disconnected"');
    expect(await output.textContent()).not.toContain(userDataDir);
    await page.getByRole("button", { name: "List chats" }).click();
    await expect.poll(() => output.textContent()).toContain('"code": "BROWSER_CLOSED"');
    expect(await page.getByLabel("Include message text").isChecked()).toBe(false);
  });

  it("prepares, cancels and confirms a synthetic message through desktop IPC", async () => {
    const launched = await launchApp();
    await launched.app.evaluate(
      ({ dialog }, { html, url }) => {
        const nodeModule = process.getBuiltinModule("node:module");
        if (!nodeModule) throw new Error("Node module hooks are unavailable");
        const stub = `
        import playwright from ${JSON.stringify(url)};
        export const chromium = {
          async launchPersistentContext(directory, options) {
            const context = await playwright.chromium.launchPersistentContext(directory, { ...options, headless: true });
            await context.route("**/*", route => route.request().url() === "https://web.telegram.org/k/"
              ? route.fulfill({ contentType: "text/html", body: ${JSON.stringify(html)} }) : route.abort());
            return context;
          }
        };
      `;
        nodeModule.registerHooks({
          resolve(specifier, context, next) {
            if (specifier === "playwright") {
              return {
                shortCircuit: true,
                url: "data:text/javascript," + encodeURIComponent(stub),
              };
            }
            return next(specifier, context);
          },
        });
        let nextResponse = 0;
        Object.assign(dialog, {
          showMessageBox: async (_window: unknown, options: { detail: string }) => {
            if (
              !options.detail.includes("Fixture message") ||
              !options.detail.includes("Test peer (101)")
            ) {
              throw new Error("The native confirmation did not contain the reviewed operation");
            }
            return { response: nextResponse++, checkboxChecked: false };
          },
        });
      },
      {
        url: playwrightModuleUrl,
        html: `
      <div id="page-chats">
        <div id="column-left">
          <div id="chatlist-container"><div class="chatlist-chat" data-peer-id="101">Test peer</div></div>
          <input class="input-search-input">
          <div class="search-super" hidden>
            <div class="chatlist-chat" data-peer-id="101"><span class="peer-title">Test peer</span></div>
            <div class="chatlist-chat" data-peer-id="102"><span class="peer-title">Other peer</span></div>
          </div>
        </div>
        <div id="column-center"><div class="chat active">
          <div class="topbar"><span class="peer-title" data-peer-id="101">Test peer</span></div>
          <div class="bubbles"></div>
          <div class="chat-input">
            <div class="input-message-input" contenteditable="true"></div>
            <button class="btn-send">Action</button>
          </div>
        </div></div>
      </div>
      <script>
        const search = document.querySelector('input');
        search.oninput = () => {
          document.querySelector('.search-super').hidden = !search.value;
          const self = search.value.toLowerCase() === 'saved messages';
          document.querySelector('.search-super [data-peer-id="101"]').innerHTML = self
            ? '<span class="peer-title">Fixture account name</span><span class="dialog-subtitle"><span class="i18n">Chat with yourself</span></span>'
            : '<span class="peer-title">Test peer</span>';
        };
        const input = document.querySelector('[contenteditable]');
        const send = document.querySelector('.btn-send');
        input.oninput = () => send.classList.toggle('send', !!input.innerText);
        send.onclick = () => {
          const bubble = document.createElement('div');
          bubble.className = 'bubble is-out is-sent';
          bubble.dataset.mid = '42';
          const message = document.createElement('div');
          message.className = 'message';
          message.textContent = input.innerText;
          bubble.append(message);
          document.querySelector('.bubbles').append(bubble);
        };
      </script>
    `,
      },
    );
    const { page } = launched;
    await page.getByLabel("New account label").fill("Fixture account");
    await page.getByRole("button", { name: "Add Account" }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByText("Send or reply", { exact: true }).click({ timeout: 12_000 });
    await page.getByLabel("Message text", { exact: true }).fill("Fixture message");
    await page.getByLabel("Recipient name or username").fill("Saved Messages");
    await page.getByRole("button", { name: "Prepare", exact: true }).click();
    await page.getByText(/Saved Messages \(101\) · Self Chat/).waitFor();
    await page.getByRole("button", { name: "Cancel preparation" }).click();
    await page.getByText("Cancelled.", { exact: true }).waitFor();
    await page.getByLabel("Recipient name or username").fill("Test");
    for (const action of ["Cancel preparation", "Review and confirm", "Review and confirm"]) {
      await page.getByRole("button", { name: "Prepare", exact: true }).click();
      await page.getByRole("button", { name: "Test peer (101)", exact: true }).click();
      await page.getByRole("button", { name: action }).click();
      await expect.poll(() => page.getByText("Working…", { exact: true }).count()).toBe(0);
    }
    await expect
      .poll(() => page.getByText("Sent. Message ID 42.", { exact: true }).count())
      .toBe(1);
  }, 30_000);

  it("creates three isolated account entries from the dashboard", async () => {
    const launched = await launchApp();

    for (const label of ["Personal", "Work", "Test"]) {
      await launched.page.getByLabel("New account label").fill(label);
      await launched.page.getByRole("button", { name: "Add Account" }).click();
      await expect
        .poll(() => launched.page.getByRole("heading", { name: label, exact: true }).count(), {
          timeout: 5_000,
        })
        .toBe(1);
    }

    const dataRoot = userDataDir;
    if (!dataRoot) throw new Error("Missing test data directory");
    const raw = JSON.parse(
      fs.readFileSync(path.join(dataRoot, "config", "accounts.json"), "utf8"),
    ) as Array<{
      label: string;
      profileDir: string;
    }>;
    expect(raw.map((account) => account.label)).toEqual(["Personal", "Work", "Test"]);
    expect(new Set(raw.map((account) => account.profileDir)).size).toBe(3);
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
