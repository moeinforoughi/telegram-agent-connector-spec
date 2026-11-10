import { execFileSync } from "node:child_process";
import type { WindowsProxySettings } from "./proxy-resolver";

const INTERNET_SETTINGS = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";

export type RegistryReader = (valueName: string) => string | null;

function defaultRegistryReader(valueName: string): string | null {
  try {
    return execFileSync("reg.exe", ["query", INTERNET_SETTINGS, "/v", valueName], {
      encoding: "utf8",
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

/** Extracts the value column from `reg query` output without trusting line order. */
export function parseRegistryValue(output: string | null): string | undefined {
  if (!output) return undefined;
  for (const line of output.split(/\r?\n/)) {
    const match = /\sREG_(?:SZ|EXPAND_SZ|DWORD)\s+(\S.*)$/.exec(line);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/**
 * Reads the per-user WinINET proxy that Chromium itself uses on Windows.
 * WinHTTP is intentionally not read: Chromium does not use the service proxy.
 */
export function readWindowsProxy(
  read: RegistryReader = defaultRegistryReader,
): WindowsProxySettings | null {
  const enabledValue = parseRegistryValue(read("ProxyEnable"));
  if (enabledValue === undefined) return null;

  const enabled = enabledValue !== "0x0" && enabledValue !== "0";
  const server = parseRegistryValue(read("ProxyServer"));
  const bypass = parseRegistryValue(read("ProxyOverride"));

  return {
    enabled,
    ...(server ? { server } : {}),
    ...(bypass ? { bypass } : {}),
  };
}
