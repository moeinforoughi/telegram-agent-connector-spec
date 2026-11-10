import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PROXY_SETTINGS,
  ProxySettingsStore,
  normalizeProxySettings,
  proxyConfigurationKey,
  toPlaywrightProxyConfig,
  type SecretCodec,
} from "../../src/core/network/proxy-settings";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-proxy-settings-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function fakeCodec(available = true): SecretCodec {
  return {
    isAvailable: async () => available,
    encrypt: async (plainText) => `enc:${Buffer.from(plainText, "utf8").toString("base64")}`,
    decrypt: async (payload) => {
      if (!payload.startsWith("enc:")) throw new Error("bad payload");
      return Buffer.from(payload.slice(4), "base64").toString("utf8");
    },
  };
}

function makeStore(codec = fakeCodec()): ProxySettingsStore {
  return new ProxySettingsStore(path.join(root, "config", "proxy.json"), { secrets: codec });
}

function settingsFile(): string {
  return path.join(root, "config", "proxy.json");
}

const base = {
  enabled: true,
  protocol: "socks5" as const,
  host: "127.0.0.1",
  port: 10808,
  username: "user",
  password: "super-secret",
};

describe("ProxySettingsStore", () => {
  it("returns editable defaults when no file exists", async () => {
    const store = makeStore();
    expect(await store.load()).toEqual(DEFAULT_PROXY_SETTINGS);
    expect(await store.getView()).toMatchObject({
      enabled: false,
      protocol: "socks5",
      host: "127.0.0.1",
      port: 10808,
      hasPassword: false,
    });
  });

  it("persists non-secret fields and encrypts credentials", async () => {
    const store = makeStore();
    const view = await store.save(base);

    expect(view).toMatchObject({
      enabled: true,
      protocol: "socks5",
      host: "127.0.0.1",
      port: 10808,
      username: "user",
      hasPassword: true,
      secureStorageAvailable: true,
    });

    const raw = fs.readFileSync(settingsFile(), "utf8");
    expect(raw).toContain("127.0.0.1");
    expect(raw).not.toContain("super-secret");
    expect(raw).not.toContain('"username"');

    expect(await store.load()).toMatchObject({
      enabled: true,
      protocol: "socks5",
      host: "127.0.0.1",
      port: 10808,
      username: "user",
      password: "super-secret",
    });
  });

  it("keeps the stored password when the save omits it", async () => {
    const store = makeStore();
    await store.save(base);

    const withoutPassword = {
      enabled: base.enabled,
      protocol: base.protocol,
      host: base.host,
      port: base.port,
      username: base.username,
    };
    await store.save(withoutPassword);

    expect((await store.load()).password).toBe("super-secret");
    expect((await store.getView()).hasPassword).toBe(true);
  });

  it("clears credentials when the username is emptied", async () => {
    const store = makeStore();
    await store.save(base);
    const withoutPassword = {
      enabled: base.enabled,
      protocol: base.protocol,
      host: base.host,
      port: base.port,
      username: "",
    };
    await store.save(withoutPassword);

    expect(await store.load()).toMatchObject({ username: "", password: "" });
    expect((await store.getView()).hasPassword).toBe(false);
    expect(fs.readFileSync(settingsFile(), "utf8")).not.toContain("enc:");
  });

  it("never persists credentials without OS encryption", async () => {
    const store = makeStore(fakeCodec(false));
    const view = await store.save(base);

    expect(view).toMatchObject({ username: "", hasPassword: false, secureStorageAvailable: false });
    const raw = fs.readFileSync(settingsFile(), "utf8");
    expect(raw).not.toContain("enc:");
    expect(raw).not.toContain("super-secret");
    expect(await store.load()).toMatchObject({ username: "", password: "" });
  });

  it("falls back to defaults for a corrupt or invalid file", async () => {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), "{not json");
    expect(await makeStore().load()).toEqual(DEFAULT_PROXY_SETTINGS);

    fs.writeFileSync(
      settingsFile(),
      JSON.stringify({ version: 1, enabled: true, protocol: "ftp" }),
    );
    expect(await makeStore().load()).toEqual(DEFAULT_PROXY_SETTINGS);
  });

  it("rejects invalid configurations", async () => {
    const store = makeStore();
    await expect(store.save({ ...base, port: 0 })).rejects.toThrow(/Invalid proxy configuration/);
    await expect(store.save({ ...base, host: "http://127.0.0.1" })).rejects.toThrow(
      /Invalid proxy configuration/,
    );
    await expect(store.save({ ...base, protocol: "ftp" as never })).rejects.toThrow(
      /Invalid proxy configuration/,
    );
    await expect(store.save({ ...base, username: "", password: "x" })).rejects.toThrow(
      /username is required/,
    );
  });
});

describe("proxy mapping", () => {
  it("validates hosts and ports through one normalization path", () => {
    expect(normalizeProxySettings(base)).toMatchObject({ host: "127.0.0.1", port: 10808 });
    expect(() => normalizeProxySettings({ ...base, host: "bad host" })).toThrow();
    expect(() => normalizeProxySettings({ ...base, port: 70_000 })).toThrow();
  });

  it("passes credentials to Playwright as separate fields", () => {
    expect(toPlaywrightProxyConfig(normalizeProxySettings(base))).toEqual({
      server: "socks5://127.0.0.1:10808",
      username: "user",
      password: "super-secret",
    });
    expect(toPlaywrightProxyConfig(normalizeProxySettings({ ...base, enabled: false }))).toBe(
      undefined,
    );
    expect(toPlaywrightProxyConfig(normalizeProxySettings({ ...base, protocol: "http" }))).toEqual({
      server: "http://127.0.0.1:10808",
      username: "user",
      password: "super-secret",
    });
  });

  it("changes the configuration key when the proxy changes", () => {
    const first = normalizeProxySettings(base);
    const second = normalizeProxySettings({ ...base, port: 12334 });
    expect(proxyConfigurationKey(first)).not.toBe(proxyConfigurationKey(second));
  });
});
