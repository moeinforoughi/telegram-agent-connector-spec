import { describe, expect, it } from "vitest";
import { parseRegistryValue, readWindowsProxy } from "../../src/core/network/windows-proxy";

const output = (value: string, kind = "REG_SZ"): string =>
  `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\r\n    Value    ${kind}    ${value}\r\n\r\n`;

describe("parseRegistryValue", () => {
  it("extracts SZ, EXPAND_SZ, and DWORD values", () => {
    expect(parseRegistryValue(output("http://127.0.0.1:8080"))).toBe("http://127.0.0.1:8080");
    expect(parseRegistryValue(output("0x1", "REG_DWORD"))).toBe("0x1");
    expect(parseRegistryValue(output("%APPDATA%\\proxy", "REG_EXPAND_SZ"))).toBe(
      "%APPDATA%\\proxy",
    );
    expect(parseRegistryValue(null)).toBeUndefined();
    expect(parseRegistryValue("no value here")).toBeUndefined();
  });
});

describe("readWindowsProxy", () => {
  it("returns null when the registry has no Internet Settings values", () => {
    expect(readWindowsProxy(() => null)).toBeNull();
  });

  it("returns the enabled proxy, server, and bypass override", () => {
    const values: Record<string, string> = {
      ProxyEnable: output("0x1", "REG_DWORD"),
      ProxyServer: output("http://127.0.0.1:8080"),
      ProxyOverride: output("<local>;localhost;*.internal"),
    };

    expect(readWindowsProxy((name) => values[name] ?? null)).toEqual({
      enabled: true,
      server: "http://127.0.0.1:8080",
      bypass: "<local>;localhost;*.internal",
    });
  });

  it("reads a disabled proxy without treating it as configured", () => {
    const values: Record<string, string> = {
      ProxyEnable: output("0x0", "REG_DWORD"),
      ProxyServer: output("http://127.0.0.1:8080"),
    };

    expect(readWindowsProxy((name) => values[name] ?? null)).toEqual({
      enabled: false,
      server: "http://127.0.0.1:8080",
    });
  });
});
