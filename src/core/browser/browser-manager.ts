import type { BrowserContext, Page } from "playwright";
import { AppError } from "../../shared/errors";
import { acquireProfileLock, releaseProfileLock } from "./profile-lock";
import type { BrowserLaunchOptions, BrowserLauncher } from "./browser-types";

export type BrowserManagerDeps = {
  readonly launcher: BrowserLauncher;
  readonly onClosed?: () => void;
  readonly log?: (message: string) => void;
};

type ActiveSession = {
  context: BrowserContext;
  page: Page;
  lockPath: string;
};

export class BrowserManager {
  private readonly launcher: BrowserLauncher;
  private readonly onClosed: (() => void) | undefined;
  private readonly log: (message: string) => void;
  private session: ActiveSession | undefined;

  constructor(deps: BrowserManagerDeps) {
    this.launcher = deps.launcher;
    this.onClosed = deps.onClosed;
    this.log = deps.log ?? ((message) => console.error(`[browser] ${message}`));
  }

  get running(): boolean {
    return this.session !== undefined;
  }

  get page(): Page | undefined {
    return this.session?.page;
  }

  async launch(options: BrowserLaunchOptions & { readonly lockPath: string }): Promise<Page> {
    if (this.session) {
      throw new AppError("PROFILE_LOCKED", "Profile is locked by this application");
    }

    acquireProfileLock(options.lockPath);
    let context: BrowserContext | undefined;
    try {
      const launched = await this.launcher({
        profileDir: options.profileDir,
        ...(options.proxy ? { proxy: options.proxy } : {}),
      });
      context = launched;
      const page = launched.pages()[0] ?? (await launched.newPage());
      this.session = { context: launched, page, lockPath: options.lockPath };
      launched.on("close", () => this.clearSession(launched, options.lockPath));
      page.on("crash", () => this.log("page crashed"));
      return page;
    } catch (error) {
      releaseProfileLock(options.lockPath);
      if (context) await context.close().catch(() => undefined);
      if (error instanceof AppError) throw error;
      this.log(`launch failed: ${error instanceof Error ? error.name : "unknown"}`);
      throw new AppError("BROWSER_LAUNCH_FAILED", "Browser launch failed", { retryable: true });
    }
  }

  async close(): Promise<void> {
    const session = this.session;
    if (!session) return;
    this.session = undefined;
    try {
      await session.context.close();
    } finally {
      releaseProfileLock(session.lockPath);
    }
  }

  private clearSession(context: BrowserContext, lockPath: string): void {
    if (this.session?.context !== context) return;
    this.session = undefined;
    releaseProfileLock(lockPath);
    this.onClosed?.();
  }
}
