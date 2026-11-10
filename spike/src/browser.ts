import { chromium, type BrowserContext } from "playwright";
import { config } from "./config.js";

export async function launchProfile(profileDir = config.profileDir): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: null,
    acceptDownloads: false,
    args: ["--no-first-run", "--no-default-browser-check"],
    ...(config.proxyServer ? { proxy: { server: config.proxyServer } } : {}),
  });
}
