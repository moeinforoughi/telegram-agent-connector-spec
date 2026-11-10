import path from "node:path";
import { app, type BrowserWindow } from "electron";
import { AccountStore } from "../core/account/account-store";
import { BrowserManager } from "../core/browser/browser-manager";
import { createPlaywrightLauncher } from "../core/browser/browser-factory";
import { resolveSystemProxy } from "../core/network/proxy-resolver";
import { createPlaywrightProbe } from "../core/telegram/login-detector";
import { APP_ID, APP_NAME } from "../shared/constants";
import type { AppInfo } from "../shared/types";
import { AccountController } from "./account-controller";
import { registerIpcHandlers, sendAccountStatus } from "./ipc-router";
import {
  buildDataPaths,
  ensureDataPaths,
  resolveDefaultUserDataRoot,
  resolveUserDataRoot,
} from "./paths";
import { createMainWindow, loadRenderer } from "./window-manager";

let mainWindow: BrowserWindow | undefined;
let accountController: AccountController | undefined;
let quitReady = false;

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

function initializeDataPaths(): void {
  const defaultUserDataRoot = resolveDefaultUserDataRoot(process.env, app.getPath("userData"));
  app.setPath("userData", resolveUserDataRoot(process.env, defaultUserDataRoot, !app.isPackaged));

  ensureDataPaths(buildDataPaths(app.getPath("userData")));
}

try {
  initializeDataPaths();
} catch (error) {
  console.error(
    "[main] failed to initialize data directories:",
    error instanceof Error ? error.name : "unknown",
  );
  process.exit(1);
}

function getAppInfo(): AppInfo {
  return {
    appName: APP_NAME,
    appVersion: app.getVersion(),
    platform: process.platform,
  };
}

function createAccountController(): AccountController {
  const userData = app.getPath("userData");
  const store = new AccountStore(
    path.join(userData, "config", "accounts.json"),
    path.join(userData, "profiles"),
  );
  const browser = new BrowserManager({
    launcher: createPlaywrightLauncher(),
    onClosed: () => accountController?.handleBrowserClosed(),
  });

  return new AccountController({
    store,
    browser,
    resolveProxy: () => resolveSystemProxy(),
    createProbe: createPlaywrightProbe,
    onView: (view) => {
      if (mainWindow) sendAccountStatus(mainWindow, view);
    },
    log: (message) => console.error(`[account] ${message}`),
  });
}

process.on("uncaughtException", (error: unknown) => {
  console.error("[main] uncaught exception:", error instanceof Error ? error.name : "unknown");
  app.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[main] unhandled rejection:", reason instanceof Error ? reason.name : "unknown");
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", (event) => {
    if (quitReady || !accountController?.running) return;
    event.preventDefault();
    void accountController.stop().finally(() => {
      quitReady = true;
      app.quit();
    });
  });

  app.on("render-process-gone", (_event, _webContents, details) => {
    console.error(`[main] renderer gone: ${details.reason}`);
  });

  app
    .whenReady()
    .then(async () => {
      mainWindow = createMainWindow(path.join(__dirname, "../preload/index.js"));
      mainWindow.on("closed", () => {
        mainWindow = undefined;
      });

      accountController = createAccountController();
      const controller = accountController;
      registerIpcHandlers(mainWindow, {
        getAppInfo,
        getAccount: () => controller.getView(),
        startAccount: () => controller.start(),
        stopAccount: () => controller.stop(),
        openTelegram: () => controller.openTelegram(),
        removeAccount: (request) => controller.remove(request.deleteProfile),
      });
      await loadRenderer(mainWindow);
    })
    .catch((error: unknown) => {
      console.error("[main] startup failed:", error instanceof Error ? error.name : "unknown");
      app.exit(1);
    });
}
