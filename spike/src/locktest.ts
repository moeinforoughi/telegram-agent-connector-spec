import path from "node:path";
import { launchProfile } from "./browser.js";
import { config } from "./config.js";
import { log } from "./logger.js";

const testProfile = path.join(config.root, "profiles", "lock-test", "chromium-user-data");

export async function testProfileLock(): Promise<number> {
  const first = await launchProfile(testProfile);
  try {
    log({ event: "lockTestFirstLaunch", ok: true });

    try {
      const second = await launchProfile(testProfile);
      await second.close();
      log({ event: "lockTestSecondLaunch", blocked: false });
      return 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log({
        event: "lockTestSecondLaunch",
        blocked: true,
        reason: message.slice(0, 300),
      });
      return 0;
    }
  } finally {
    await first.close();
  }
}

process.exitCode = await testProfileLock();
