import { safeStorage } from "electron";
import type { SecretCodec } from "../core/network/proxy-settings";

/**
 * OS-backed encryption for proxy credentials (DPAPI on Windows through
 * Electron safeStorage). If the OS facility is unavailable, callers must not
 * persist credentials at all.
 */
export function createElectronSecretCodec(): SecretCodec {
  return {
    available: () => {
      try {
        return safeStorage.isEncryptionAvailable();
      } catch {
        return false;
      }
    },
    encrypt: (plainText) => safeStorage.encryptString(plainText).toString("base64"),
    decrypt: (payload) => safeStorage.decryptString(Buffer.from(payload, "base64")),
  };
}
