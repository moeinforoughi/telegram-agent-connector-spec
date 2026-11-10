import fs from "node:fs";
import { launchProfile } from "./browser.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { openTelegram } from "./navigation.js";
import { countChatItems, detectLoginState, pageFacts } from "./telegram.js";

export async function verifyPersistedSession(): Promise<number> {
  const profileExists = fs.existsSync(config.profileDir);
  log({ event: "verifyProfile", profileDirExists: profileExists });

  const context = await launchProfile();
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const finalUrl = await openTelegram(page);
    const facts = await pageFacts(page);
    const detection = await detectLoginState(page);

    log({
      event: "verifySession",
      finalUrl,
      titleIsTelegram: facts.titleIsTelegram,
      loginState: detection.state,
      evidence: detection.evidence.join(",") || "none",
    });

    if (detection.state !== "CONNECTED") {
      log({ event: "verifyResult", ok: false, reason: detection.state });
      return 1;
    }

    const chats = await countChatItems(page);
    log({
      event: "verifyChatList",
      selector: chats.selector,
      count: chats.count,
      readable: chats.count > 0,
    });
    log({ event: "verifyResult", ok: chats.count > 0 });
    return chats.count > 0 ? 0 : 1;
  } finally {
    await context.close();
  }
}

process.exitCode = await verifyPersistedSession();
