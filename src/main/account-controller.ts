import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import type { AccountStore, StoredAccount } from "../core/account/account-store";
import type { BrowserLaunchOptions } from "../core/browser/browser-types";
import {
  proxyConfigurationKey,
  toPlaywrightProxyConfig,
  type ProxySettings,
} from "../core/network/proxy-settings";
import { detectLoginState, type PageProbe } from "../core/telegram/login-detector";
import { waitForConnected, type LoginMonitorOptions } from "../core/telegram/login-monitor";
import { openTelegram } from "../core/telegram/navigation";
import type { LoginDetection } from "../core/telegram/telegram-types";
import type { AccountView } from "../shared/account";
import { AppError, isAppError, toSerializedError } from "../shared/errors";

export type BrowserDriver = {
  readonly running: boolean;
  readonly page: Page | undefined;
  launch(options: BrowserLaunchOptions & { readonly lockPath: string }): Promise<Page>;
  close(): Promise<void>;
};

export type AccountControllerDeps = {
  readonly store: AccountStore;
  readonly browser: BrowserDriver;
  /** Manual proxy settings; this is the only proxy source for the browser. */
  readonly getProxySettings: () => ProxySettings;
  readonly createProbe: (page: Page) => PageProbe;
  readonly monitor?: (options: LoginMonitorOptions) => Promise<LoginDetection>;
  readonly onView: (view: AccountView) => void;
  readonly now?: () => Date;
  readonly log?: (message: string) => void;
};

const EMPTY_VIEW: AccountView = {
  id: null,
  label: "No account",
  status: "disconnected",
};

const ACTIVE_STATUSES = ["waiting_for_login", "authenticating", "connected"] as const;

export class AccountController {
  private readonly deps: AccountControllerDeps;
  private view: AccountView = EMPTY_VIEW;
  private account: StoredAccount | undefined;
  private page: Page | undefined;
  private proxyKey: string | undefined;
  private generation = 0;
  private stopping = false;
  private starting: Promise<AccountView> | undefined;

  constructor(deps: AccountControllerDeps) {
    this.deps = deps;
  }

  getView(): AccountView {
    return { ...this.view };
  }

  get running(): boolean {
    return this.deps.browser.running;
  }

  start(): Promise<AccountView> {
    if (this.starting) return this.starting;
    this.starting = this.doStart().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  async openTelegram(): Promise<AccountView> {
    if (this.deps.browser.running && this.page) {
      await this.page.bringToFront().catch(() => undefined);
      return this.getView();
    }
    return this.start();
  }

  async stop(): Promise<AccountView> {
    this.generation += 1;
    this.stopping = true;
    try {
      await this.deps.browser.close();
    } finally {
      this.stopping = false;
      this.page = undefined;
      this.proxyKey = undefined;
      this.setView({
        id: this.view.id,
        label: this.view.label,
        status: "disconnected",
        ...(this.view.createdAt ? { createdAt: this.view.createdAt } : {}),
        ...(this.view.lastConnectedAt ? { lastConnectedAt: this.view.lastConnectedAt } : {}),
      });
    }
    return this.getView();
  }

  async remove(deleteProfile: boolean): Promise<AccountView> {
    const account = this.deps.store.getFirst();
    await this.stop();
    if (!account) return this.getView();

    this.deps.store.remove(account.id);
    if (deleteProfile) {
      fs.rmSync(path.dirname(account.profileDir), { recursive: true, force: true });
    }
    this.account = undefined;
    this.setView(EMPTY_VIEW);
    return this.getView();
  }

  /** Called by the BrowserManager when the Chromium window closes. */
  handleBrowserClosed(): void {
    if (this.stopping) return;
    this.generation += 1;
    this.page = undefined;
    this.proxyKey = undefined;
    this.fail(new AppError("BROWSER_CLOSED", "The browser window was closed", { retryable: true }));
  }

  private async doStart(): Promise<AccountView> {
    // Already connected or waiting: focus the existing window instead of
    // starting a second monitor.
    if (this.deps.browser.running && this.page) {
      if (ACTIVE_STATUSES.includes(this.view.status as (typeof ACTIVE_STATUSES)[number])) {
        await this.page.bringToFront().catch(() => undefined);
        return this.getView();
      }
    }

    const generation = (this.generation += 1);
    this.setView({ ...EMPTY_VIEW, status: "initializing" });

    try {
      const account = this.account ?? this.deps.store.getFirst() ?? this.deps.store.create();
      this.account = account;
      this.setView({
        id: account.id,
        label: account.label,
        status: "initializing",
        createdAt: account.createdAt,
        ...(account.lastConnectedAt ? { lastConnectedAt: account.lastConnectedAt } : {}),
      });

      const settings = this.deps.getProxySettings();
      const proxyKey = proxyConfigurationKey(settings);
      const proxy = toPlaywrightProxyConfig(settings);

      if (this.deps.browser.running && (!this.page || this.page.isClosed())) {
        await this.deps.browser.close().catch(() => undefined);
        this.page = undefined;
        this.proxyKey = undefined;
      }

      if (this.deps.browser.running && proxyKey !== this.proxyKey) {
        // The user changed the proxy; relaunch so the new settings apply.
        await this.deps.browser.close().catch(() => undefined);
        this.page = undefined;
        this.proxyKey = undefined;
      }

      if (!this.deps.browser.running) {
        this.log(
          `starting browser (${settings.enabled ? `${settings.protocol} proxy` : "direct"})`,
        );
        const page = await this.deps.browser.launch({
          profileDir: account.profileDir,
          lockPath: path.join(path.dirname(account.profileDir), "profile.lock"),
          ...(proxy ? { proxy } : {}),
        });
        if (generation !== this.generation) {
          await this.deps.browser.close().catch(() => undefined);
          return this.getView();
        }
        this.page = page;
        this.proxyKey = proxyKey;
      } else {
        this.log(`reusing browser (${settings.enabled ? `${settings.protocol} proxy` : "direct"})`);
      }

      return await this.connect(generation, settings.enabled);
    } catch (error) {
      // A successfully launched browser is never closed because of a network or
      // navigation error: the profile and session stay intact for Retry.
      if (!this.deps.browser.running) {
        await this.deps.browser.close().catch(() => undefined);
        this.page = undefined;
        this.proxyKey = undefined;
      }
      this.fail(error);
      return this.getView();
    }
  }

  private async connect(generation: number, proxyEnabled: boolean): Promise<AccountView> {
    const page = this.page;
    if (!page) {
      throw new AppError("BROWSER_LAUNCH_FAILED", "Browser page is unavailable", {
        retryable: true,
      });
    }

    try {
      await openTelegram(page);
    } catch (error) {
      if (isAppError(error) && error.code === "NETWORK_ERROR" && proxyEnabled) {
        throw new AppError(
          "PROXY_ERROR",
          "Telegram Web could not be reached through the configured proxy",
          { retryable: true, cause: error },
        );
      }
      throw error;
    }

    if (generation !== this.generation) return this.getView();
    this.setView({ ...this.view, status: "waiting_for_login", loginState: "LOGIN_REQUIRED" });
    void this.runMonitor(generation);
    return this.getView();
  }

  private async runMonitor(generation: number): Promise<void> {
    const page = this.page;
    if (!page) return;
    const monitor = this.deps.monitor ?? waitForConnected;

    try {
      const detection = await monitor({
        detect: () => detectLoginState(this.deps.createProbe(page)),
        isPageClosed: () => page.isClosed(),
        onState: (state) => {
          if (generation !== this.generation) return;
          if (state === "LOGIN_REQUIRED") {
            this.setView({
              ...this.view,
              status: "waiting_for_login",
              loginState: "LOGIN_REQUIRED",
            });
          } else if (state === "AUTHENTICATING") {
            this.setView({ ...this.view, status: "authenticating", loginState: "AUTHENTICATING" });
          } else if (state === "CONNECTED") {
            this.setView({ ...this.view, status: "connected", loginState: "CONNECTED" });
          }
        },
      });

      if (generation !== this.generation || !this.deps.browser.running) return;
      if (detection.state !== "CONNECTED") return;

      const connectedAt = (this.deps.now ?? (() => new Date()))().toISOString();
      if (this.account) this.deps.store.updateLastConnected(this.account.id, connectedAt);
      this.setView({
        ...this.view,
        status: "connected",
        loginState: "CONNECTED",
        lastConnectedAt: connectedAt,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    const serialized = toSerializedError(error);
    this.log(`error ${serialized.code}`);
    this.setView({ ...this.view, status: "error", error: serialized });
  }

  private setView(view: AccountView): void {
    this.view = view;
    this.deps.onView({ ...view });
  }

  private log(message: string): void {
    (this.deps.log ?? ((entry) => console.error(`[account] ${entry}`)))(message);
  }
}
