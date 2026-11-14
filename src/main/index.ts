import path from "node:path";
import { app, dialog, type BrowserWindow } from "electron";
import { AccountStore } from "../core/account/account-store";
import { BrowserManager } from "../core/browser/browser-manager";
import { createPlaywrightLauncher } from "../core/browser/browser-factory";
import { probeProxy } from "../core/network/proxy-probe";
import { ProxySettingsStore } from "../core/network/proxy-settings";
import { createPlaywrightProbe } from "../core/telegram/login-detector";
import { APP_ID, APP_NAME } from "../shared/constants";
import type { AppInfo } from "../shared/types";
import { AccountManager } from "./account-manager";
import { registerIpcHandlers, sendAccountStatus } from "./ipc-router";
import {
  buildDataPaths,
  ensureDataPaths,
  resolveDefaultUserDataRoot,
  resolveUserDataRoot,
} from "./paths";
import { createElectronSecretCodec } from "./secure-storage";
import { createMainWindow, loadRenderer } from "./window-manager";
import { RecipientResolver } from "./recipient-resolver";
import { TelegramReadAdapter } from "./telegram-read-adapter";
import { TelegramService } from "./telegram-service";

let mainWindow: BrowserWindow | undefined;
let accountManager: AccountManager | undefined;
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

function createServices(): {
  manager: AccountManager;
  proxy: ProxySettingsStore;
  telegram: TelegramService;
} {
  const userData = app.getPath("userData");
  const store = new AccountStore(
    path.join(userData, "config", "accounts.json"),
    path.join(userData, "profiles"),
  );
  const proxy = new ProxySettingsStore(path.join(userData, "config", "proxy.json"), {
    secrets: createElectronSecretCodec(),
  });

  const adapter = new TelegramReadAdapter({ pageSource: (id) => manager.getPage(id) });
  const resolver = new RecipientResolver({
    search: async (accountId, query, limit) =>
      (await adapter.searchChats(accountId, query, { limit })).map(({ id, title, type }) => ({
        id,
        title,
        type,
      })),
  });
  const checkedPages = new WeakSet<object>();
  const manager: AccountManager = new AccountManager({
    store,
    createBrowser: (onClosed) =>
      new BrowserManager({ launcher: createPlaywrightLauncher(), onClosed }),
    getProxySettings: () => proxy.load(),
    createProbe: createPlaywrightProbe,
    onView: (view) => {
      if (mainWindow) sendAccountStatus(mainWindow, view);
      if (!view.id) return;
      if (view.status !== "connected") {
        resolver.invalidate(view.id);
        return;
      }
      const page = manager.getPage(view.id);
      if (!page || checkedPages.has(page)) return;
      checkedPages.add(page);
      void adapter.getUiHealth(view.id).catch(() => undefined);
    },
    log: (message) => console.error(`[account] ${message}`),
  });

  const telegram = new TelegramService({
    listAccounts: () => manager.list(),
    adapter,
    resolver,
    messaging: adapter,
    messageSession: (id) => manager.getPage(id),
  });
  return { manager, proxy, telegram };
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
    if (quitReady || !accountManager?.hasRunningBrowsers) return;
    event.preventDefault();
    void accountManager.shutdown().finally(() => {
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

      const services = createServices();
      accountManager = services.manager;
      registerIpcHandlers(mainWindow, {
        getAppInfo,
        telegram: services.telegram,
        approveMessage: async (operation) => {
          if (!mainWindow || !mainWindow.isFocused()) return false;
          const result = await dialog.showMessageBox(mainWindow, {
            type: "question",
            title: "Confirm Telegram message",
            message: operation.kind === "reply" ? "Send this reply?" : "Send this message?",
            detail: [
              `Account: ${operation.accountLabel} (${operation.accountId})`,
              `Chat: ${operation.recipient.title} (${operation.recipient.id})`,
              ...(operation.kind === "reply"
                ? [`Reply to message ${operation.messageId}`, operation.targetPreview]
                : []),
              "",
              operation.text,
            ].join("\n"),
            buttons: ["Cancel", "Send once"],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          });
          return result.response === 1;
        },
        listAccounts: () => services.manager.list(),
        createAccount: (request) => services.manager.create(request.label),
        renameAccount: (request) => services.manager.rename(request.id, request.label),
        startAccount: (request) => services.manager.start(request.id),
        stopAccount: (request) => services.manager.stop(request.id),
        openTelegram: (request) => services.manager.open(request.id),
        removeAccount: (request) => services.manager.remove(request.id, request.deleteProfile),
        getProxySettings: () => services.proxy.getView(),
        saveProxySettings: (request) => services.proxy.save(request),
        testProxy: (request) => probeProxy(request),
      });
      await loadRenderer(mainWindow);
    })
    .catch((error: unknown) => {
      console.error("[main] startup failed:", error instanceof Error ? error.name : "unknown");
      app.exit(1);
    });
}
