import { launchProfile } from "./browser.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { openTelegram } from "./navigation.js";
import { detectLoginState } from "./telegram.js";

export async function waitForLogin(): Promise<number> {
  const context = await launchProfile();
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const finalUrl = await openTelegram(page);
    let previous = "";
    const deadline = Date.now() + config.loginTimeoutMs;

    log({
      event: "loginWindowOpened",
      finalUrl,
      timeoutSec: Math.round(config.loginTimeoutMs / 1000),
    });

    while (Date.now() < deadline) {
      const detection = await detectLoginState(page);
      if (detection.state !== previous) {
        log({
          event: "loginState",
          state: detection.state,
          evidence: detection.evidence.join(",") || "none",
        });
        previous = detection.state;
      }

      if (detection.state === "CONNECTED") {
        await page.waitForTimeout(3_000);
        log({ event: "loginConfirmed", state: detection.state });
        return 0;
      }

      if (context.pages().length === 0) {
        log({ event: "browserClosedByUser" });
        return 2;
      }

      await page.waitForTimeout(2_000);
    }

    log({ event: "loginTimeout" });
    return 1;
  } finally {
    await context.close();
  }
}

process.exitCode = await waitForLogin();
