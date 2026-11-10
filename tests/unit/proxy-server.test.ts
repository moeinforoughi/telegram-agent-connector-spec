import { describe, expect, it } from "vitest";
import { parseProxyServer } from "../../src/core/network/proxy-server";

describe("parseProxyServer", () => {
  it("accepts http, https and socks5 with an explicit port", () => {
    expect(parseProxyServer("http://127.0.0.1:8080")).toEqual({
      server: "http://127.0.0.1:8080",
      requiresAuthentication: false,
    });
    expect(parseProxyServer("https://proxy.local:8443").server).toBe("https://proxy.local:8443");
    expect(parseProxyServer("socks5://127.0.0.1:10808").server).toBe("socks5://127.0.0.1:10808");
  });

  it("defaults a scheme-less value to http", () => {
    expect(parseProxyServer("127.0.0.1:3128").server).toBe("http://127.0.0.1:3128");
  });

  it("keeps credentials separate from the server URL", () => {
    const parsed = parseProxyServer("socks5://user:p%40ss@127.0.0.1:10808");
    expect(parsed.server).toBe("socks5://127.0.0.1:10808");
    expect(parsed.requiresAuthentication).toBe(true);
    expect(parsed.credentials).toEqual({ username: "user", password: "p@ss" });
  });

  it("rejects unsupported schemes and malformed values", () => {
    expect(() => parseProxyServer("")).toThrow(/Invalid proxy server/);
    expect(() => parseProxyServer("ftp://127.0.0.1:21")).toThrow(/Invalid proxy server/);
    expect(() => parseProxyServer("http://127.0.0.1")).toThrow(/Invalid proxy server/);
    expect(() => parseProxyServer("http://127.0.0.1:8080/path")).toThrow(/Invalid proxy server/);
    expect(() => parseProxyServer("http://127.0.0.1:8080?x=1")).toThrow(/Invalid proxy server/);
    expect(() => parseProxyServer("http://127.0.0.1:70000")).toThrow(/Invalid proxy server/);
  });
});
