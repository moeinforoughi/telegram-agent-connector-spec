import { safeStorage } from "electron";
import type { SecretCodec } from "../core/network/proxy-settings";

/**
 * OS-backed encryption for proxy credentials (DPAPI on Windows through
 * Electron safeStorage). If the OS facility is unavailable, callers must not
 * persist credentials at all.
 */
export function createElectronSecretCodec(): SecretCodec {
  return {
    isAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
    encrypt: async (plainText) =>
      (await safeStorage.encryptStringAsync(plainText)).toString("base64"),
    decrypt: async (payload) =>
      (await safeStorage.decryptStringAsync(Buffer.from(payload, "base64"))).result,
  };
}
