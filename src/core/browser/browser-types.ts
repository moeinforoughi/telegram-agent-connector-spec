import type { BrowserContext, Page } from "playwright";
import type { PlaywrightProxy } from "../network/proxy-server";

export type BrowserLaunchOptions = {
  readonly profileDir: string;
  readonly proxy?: PlaywrightProxy;
};

export type BrowserLauncher = (options: BrowserLaunchOptions) => Promise<BrowserContext>;

export type BrowserSession = {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly lockPath: string;
};
