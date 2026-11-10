import { describe, expect, it } from "vitest";
import {
  describeProxy,
  parseProxyServer,
  redactProxyServer,
  resolveProxy,
  resolveSystemProxy,
  toPlaywrightProxy,
  type WindowsProxySettings,
} from "../../src/core/network/proxy-resolver";

const windows = (overrides: Partial<WindowsProxySettings> = {}): WindowsProxySettings => ({
  enabled: true,
  server: "http://10.0.0.5:8080",
  bypass: "<local>;localhost;*.internal",
  ...overrides,
});

describe("resolveProxy", () => {
  it("falls back to direct when no source is configured", () => {
    expect(resolveProxy({ env: {}, windows: null })).toEqual({
      source: "direct",
      mode: "direct",
      requiresAuthentication: false,
    });
  });

  it("prefers an explicit manual proxy over every other source", () => {
    const result = resolveProxy({
      manual: "http://127.0.0.1:1111",
      phase0: "http://127.0.0.1:2222",
      env: { HTTPS_PROXY: "http://127.0.0.1:3333" },
      windows: windows(),
    });

    expect(result).toMatchObject({
      source: "manual",
      mode: "proxy",
      server: "http://127.0.0.1:1111",
    });
  });

  it("uses the proven Phase 0 proxy before the Windows registry", () => {
    const result = resolveProxy({
      phase0: "http://127.0.0.1:2222",
      env: { HTTPS_PROXY: "http://127.0.0.1:3333" },
      windows: windows(),
    });

    expect(result.source).toBe("phase0");
    expect(result.server).toBe("http://127.0.0.1:2222");
  });

  it("uses the Windows proxy before environment variables", () => {
    const result = resolveProxy({
      phase0: "   ",
      env: { HTTPS_PROXY: "http://127.0.0.1:3333" },
      windows: windows(),
    });

    expect(result).toMatchObject({
      source: "windows",
      server: "http://10.0.0.5:8080",
      bypass: ["<local>", "localhost", "*.internal"],
    });
  });

  it("ignores a disabled Windows proxy", () => {
    const result = resolveProxy({
      env: { HTTPS_PROXY: "http://127.0.0.1:3333" },
      windows: windows({ enabled: false }),
    });

    expect(result.source).toBe("environment");
  });

  it("supports uppercase and lowercase environment variables in priority order", () => {
    expect(
      resolveProxy({
        env: {
          HTTPS_PROXY: "http://127.0.0.1:4430",
          HTTP_PROXY: "http://127.0.0.1:8080",
          ALL_PROXY: "socks5://127.0.0.1:9050",
        },
        windows: null,
      }).server,
    ).toBe("http://127.0.0.1:4430");

    expect(
      resolveProxy({
        env: { https_proxy: "http://127.0.0.1:4431", all_proxy: "socks5://127.0.0.1:9051" },
        windows: null,
      }).server,
    ).toBe("http://127.0.0.1:4431");
  });

  it("accepts HTTP, HTTPS, and SOCKS5 proxies", () => {
    for (const server of [
      "http://127.0.0.1:8080",
      "https://127.0.0.1:8443",
      "socks5://127.0.0.1:1080",
    ]) {
      const result = resolveProxy({ manual: server, env: {}, windows: null });
      expect(result.mode).toBe("proxy");
      expect(result.server).toBe(server);
    }
  });

  it("assumes HTTP when the scheme is missing", () => {
    expect(resolveProxy({ manual: "127.0.0.1:8080", env: {}, windows: null }).server).toBe(
      "http://127.0.0.1:8080",
    );
  });

  it("rejects an invalid explicit proxy instead of silently going direct", () => {
    expect(() => resolveProxy({ manual: "not a proxy", env: {}, windows: null })).toThrow(
      "Invalid proxy server",
    );
    expect(() =>
      resolveProxy({ manual: "http://host-without-port", env: {}, windows: null }),
    ).toThrow("Invalid proxy server");
    expect(() => resolveProxy({ manual: "ftp://127.0.0.1:21", env: {}, windows: null })).toThrow(
      "Invalid proxy server",
    );
    expect(() =>
      resolveProxy({ manual: "http://127.0.0.1:99999", env: {}, windows: null }),
    ).toThrow("Invalid proxy server");
  });

  it("rejects a malformed Windows proxy when Windows proxy is enabled", () => {
    expect(() =>
      resolveProxy({
        env: { HTTPS_PROXY: "http://127.0.0.1:3333" },
        windows: windows({ server: "http://bad host:8080" }),
      }),
    ).toThrow("Invalid proxy server");
  });

  it("reads bypass lists from NO_PROXY and the Windows override", () => {
    const fromEnv = resolveProxy({
      env: { HTTPS_PROXY: "http://127.0.0.1:8080", NO_PROXY: "localhost, .internal, 10.0.0.0/8" },
      windows: null,
    });
    expect(fromEnv.bypass).toEqual(["localhost", ".internal", "10.0.0.0/8"]);
  });

  it("detects proxy credentials and marks authentication", () => {
    const result = resolveProxy({
      manual: "http://user:secret@127.0.0.1:8080",
      env: {},
      windows: null,
    });

    expect(result.requiresAuthentication).toBe(true);
    expect(result.server).toBe("http://127.0.0.1:8080");
    expect(result.credentials).toEqual({ username: "user", password: "secret" });
  });
});

describe("redaction", () => {
  it("removes credentials from a proxy URL", () => {
    expect(redactProxyServer("http://user:secret@127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(redactProxyServer("socks5://user:secret@127.0.0.1:1080")).toBe(
      "socks5://127.0.0.1:1080",
    );
  });

  it("never prints credentials in a description", () => {
    const result = resolveProxy({
      manual: "http://user:secret@127.0.0.1:8080",
      env: {},
      windows: null,
    });

    const description = describeProxy(result);
    expect(description).toContain("source=manual");
    expect(description).toContain("http://127.0.0.1:8080");
    expect(description).not.toContain("user");
    expect(description).not.toContain("secret");
  });

  it("passes credentials to Playwright separately from the server", () => {
    const result = resolveProxy({
      manual: "http://user:secret@127.0.0.1:8080",
      env: {},
      windows: null,
    });

    expect(toPlaywrightProxy(result)).toEqual({
      server: "http://127.0.0.1:8080",
      username: "user",
      password: "secret",
    });
  });

  it("returns no Playwright proxy in direct mode", () => {
    expect(toPlaywrightProxy(resolveProxy({ env: {}, windows: null }))).toBeUndefined();
  });
});

describe("parseProxyServer", () => {
  it("keeps IPv6 hosts and rejects paths", () => {
    expect(parseProxyServer("http://[::1]:8080").server).toBe("http://[::1]:8080");
    expect(() => parseProxyServer("http://127.0.0.1:8080/path")).toThrow("Invalid proxy server");
    expect(() => parseProxyServer("")).toThrow("Invalid proxy server");
  });
});

describe("resolveSystemProxy", () => {
  it("uses the manual setting without reading the Windows registry", () => {
    let read = false;
    const result = resolveSystemProxy({ CONNECTOR_PROXY_SERVER: "socks5://127.0.0.1:1080" }, () => {
      read = true;
      return null;
    });

    expect(result.source).toBe("manual");
    expect(read).toBe(false);
  });

  it("reads the Windows registry when no explicit source exists", () => {
    const result = resolveSystemProxy({}, () => ({
      enabled: true,
      server: "http://127.0.0.1:8080",
    }));

    expect(result.source).toBe("windows");
  });
});
