import { launchProfile } from "./browser.js";
import { log } from "./logger.js";
import { openTelegram } from "./navigation.js";
import { detectLoginState, pageFacts } from "./telegram.js";
import { SELECTORS } from "./telegram.js";

export async function probe(): Promise<void> {
  const context = await launchProfile();
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const finalUrl = await openTelegram(page);
    const facts = await pageFacts(page);
    const detection = await detectLoginState(page);

    log({
      event: "probe",
      finalUrl,
      titleIsTelegram: facts.titleIsTelegram,
      loginState: detection.state,
      evidence: detection.evidence.join(",") || "none",
    });

    for (const [group, selectors] of Object.entries(SELECTORS)) {
      for (const selector of selectors) {
        const count = await page.locator(selector).count().catch(() => -1);
        log({ event: "selectorCount", group, selector, count });
      }
    }

    process.stdout.write(
      JSON.stringify({ url: finalUrl, state: detection.state }) + "\n",
    );
  } finally {
    await context.close();
  }
}

await probe();
