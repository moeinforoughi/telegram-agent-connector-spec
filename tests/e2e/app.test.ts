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

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tac-e2e-"));
  const launched = await electron.launch({
    args: [projectRoot],
    cwd: projectRoot,
    env: {
      ...process.env,
      CONNECTOR_USER_DATA_DIR: userDataDir,
      NODE_ENV: "test",
    },
  });
  app = launched;
  page = await launched.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app: launched, page };
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
    expect(renderer.apiKeys).toEqual(["getAppInfo"]);
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
