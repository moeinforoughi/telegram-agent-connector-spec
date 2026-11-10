import { describe, expect, it } from "vitest";
import { IPC_ALLOWLIST, IPC_CHANNELS } from "../../src/shared/ipc";
import { isTrustedSender } from "../../src/main/trusted-sender";

describe("IPC allowlist", () => {
  it("contains exactly the intended channels", () => {
    expect(IPC_ALLOWLIST).toEqual([
      IPC_CHANNELS.getAppInfo,
      IPC_CHANNELS.listAccounts,
      IPC_CHANNELS.createAccount,
      IPC_CHANNELS.renameAccount,
      IPC_CHANNELS.startAccount,
      IPC_CHANNELS.stopAccount,
      IPC_CHANNELS.openTelegram,
      IPC_CHANNELS.removeAccount,
      IPC_CHANNELS.getProxySettings,
      IPC_CHANNELS.saveProxySettings,
      IPC_CHANNELS.testProxy,
    ]);
  });

  it("does not contain duplicate channels", () => {
    expect(new Set(IPC_ALLOWLIST).size).toBe(IPC_ALLOWLIST.length);
  });
});

describe("isTrustedSender", () => {
  const appUrl = "file:///app/index.html";

  it("accepts only the expected webContents main frame and URL", () => {
    expect(isTrustedSender(7, true, 7, appUrl, appUrl)).toBe(true);
    expect(isTrustedSender(7, false, 7, appUrl, appUrl)).toBe(false);
    expect(isTrustedSender(8, true, 7, appUrl, appUrl)).toBe(false);
    expect(isTrustedSender(7, true, 7, "https://evil.example/", appUrl)).toBe(false);
    expect(isTrustedSender(7, true, 7, null, appUrl)).toBe(false);
  });
});
