import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import type { AccountStore, StoredAccount } from "../core/account/account-store";
import type { BrowserDriver } from "./account-controller";
import { AccountController } from "./account-controller";
import type { ProxySettings } from "../core/network/proxy-settings";
import type { PageProbe } from "../core/telegram/login-detector";
import type { LoginMonitorOptions } from "../core/telegram/login-monitor";
import type { LoginDetection } from "../core/telegram/telegram-types";
import type { AccountView } from "../shared/account";
import { AppError } from "../shared/errors";

export type AccountRuntime = {
  readonly controller: AccountController;
  readonly browser: BrowserDriver;
};

export type AccountManagerDeps = {
  readonly store: AccountStore;
  /** Creates one browser driver per account and wires its close hook. */
  readonly createBrowser: (onClosed: () => void) => BrowserDriver;
  readonly getProxySettings: () => Promise<ProxySettings>;
  readonly createProbe: (page: Page) => PageProbe;
  readonly monitor?: (options: LoginMonitorOptions) => Promise<LoginDetection>;
  readonly now?: () => Date;
  readonly maxActive?: number;
  readonly onView: (view: AccountView) => void;
  readonly log?: (message: string) => void;
};

function baseView(account: StoredAccount): AccountView {
  return {
    id: account.id,
    label: account.label,
    status: "disconnected",
    createdAt: account.createdAt,
    ...(account.lastConnectedAt ? { lastConnectedAt: account.lastConnectedAt } : {}),
  };
}

/**
 * Owns account runtimes. One runtime = one AccountController + one BrowserManager
 * for that account's profile. Runtimes are created lazily on first start/open.
 */
export class AccountManager {
  private readonly deps: AccountManagerDeps;
  private readonly runtimes = new Map<string, AccountRuntime>();
  private readonly views = new Map<string, AccountView>();

  constructor(deps: AccountManagerDeps) {
    this.deps = deps;
  }

  get activeBrowserCount(): number {
    let count = 0;
    for (const runtime of this.runtimes.values()) {
      if (runtime.browser.running) count += 1;
    }
    return count;
  }

  /** Main-only: the live page for one account (undefined when not running). */
  getPage(id: string): Page | undefined {
    return this.runtimes.get(id)?.controller.getPage();
  }

  get hasRunningBrowsers(): boolean {
    return this.activeBrowserCount > 0;
  }

  get maxActive(): number {
    return this.deps.maxActive ?? 3;
  }

  list(): AccountView[] {
    return this.deps.store.list().map((account) => this.views.get(account.id) ?? baseView(account));
  }

  create(label?: string): AccountView {
    const account = this.deps.store.create(label);
    const view = baseView(account);
    this.views.set(account.id, view);
    return view;
  }

  rename(id: string, label: string): AccountView {
    const account = this.deps.store.rename(id, label);
    if (!account) throw new AppError("ACCOUNT_NOT_FOUND", "Account was not found");
    this.runtimes.get(id)?.controller.updateLabel(account.label);
    const view = { ...(this.views.get(id) ?? baseView(account)), label: account.label };
    this.views.set(id, view);
    this.deps.onView({ ...view });
    return view;
  }

  async start(id: string): Promise<AccountView> {
    const runtime = this.runtimeFor(id);
    this.assertCanLaunch(runtime);
    return runtime.controller.start();
  }

  async open(id: string): Promise<AccountView> {
    const runtime = this.runtimeFor(id);
    this.assertCanLaunch(runtime);
    return runtime.controller.openTelegram();
  }

  async stop(id: string): Promise<AccountView> {
    const runtime = this.runtimes.get(id);
    if (runtime) return runtime.controller.stop();
    const account = this.requireAccount(id);
    return this.views.get(id) ?? baseView(account);
  }

  async remove(id: string, deleteProfile: boolean): Promise<{ readonly removed: true }> {
    const account = this.requireAccount(id);
    const runtime = this.runtimes.get(id);
    if (runtime) await runtime.controller.stop();

    this.deps.store.remove(id);
    this.runtimes.delete(id);
    this.views.delete(id);

    if (deleteProfile) {
      fs.rmSync(path.dirname(account.profileDir), { recursive: true, force: true });
    }
    return { removed: true };
  }

  async shutdown(): Promise<void> {
    const runtimes = [...this.runtimes.values()];
    await Promise.allSettled(runtimes.map((runtime) => runtime.controller.stop()));
  }

  private runtimeFor(id: string): AccountRuntime {
    const existing = this.runtimes.get(id);
    if (existing) return existing;

    this.requireAccount(id);
    const holder: { controller?: AccountController } = {};
    const browser = this.deps.createBrowser(() => holder.controller?.handleBrowserClosed());
    const controller = new AccountController({
      store: this.deps.store,
      browser,
      accountId: id,
      getProxySettings: this.deps.getProxySettings,
      createProbe: this.deps.createProbe,
      ...(this.deps.monitor ? { monitor: this.deps.monitor } : {}),
      ...(this.deps.now ? { now: this.deps.now } : {}),
      ...(this.deps.log ? { log: this.deps.log } : {}),
      onView: (view) => {
        this.views.set(id, view);
        this.deps.onView(view);
      },
    });
    holder.controller = controller;

    const runtime: AccountRuntime = { controller, browser };
    this.runtimes.set(id, runtime);
    return runtime;
  }

  private assertCanLaunch(runtime: AccountRuntime): void {
    if (runtime.browser.running) return;
    if (this.activeBrowserCount >= this.maxActive) {
      throw new AppError(
        "BROWSER_LIMIT_REACHED",
        `At most ${this.maxActive} browsers can be open at the same time`,
        { retryable: true },
      );
    }
  }

  private requireAccount(id: string): StoredAccount {
    const account = this.deps.store.getById(id);
    if (!account) throw new AppError("ACCOUNT_NOT_FOUND", "Account was not found");
    return account;
  }
}
