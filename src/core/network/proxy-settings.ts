import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors";
import type {
  ProxyProtocol,
  ProxySettingsView,
  SaveProxySettingsRequest,
} from "../../shared/proxy";
import { DEFAULT_PROXY_FORM, PROXY_PROTOCOLS } from "../../shared/proxy";
import { parseProxyServer, type PlaywrightProxy } from "./proxy-server";

export type ProxySettings = {
  readonly enabled: boolean;
  readonly protocol: ProxyProtocol;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  /** Kept in memory only; encrypted before it touches disk. */
  readonly password: string;
};

export type ProxyInput = {
  readonly enabled: boolean;
  readonly protocol: ProxyProtocol;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
};

export type SecretCodec = {
  isAvailable(): Promise<boolean>;
  encrypt(plainText: string): Promise<string>;
  decrypt(payload: string): Promise<string>;
};

export type ProxyStoreDeps = {
  readonly secrets: SecretCodec;
};

type ProxyFile = {
  readonly version: 1;
  readonly enabled: boolean;
  readonly protocol: ProxyProtocol;
  readonly host: string;
  readonly port: number;
  readonly credentials?: string;
};

type StoredCredentials = {
  readonly username: string;
  readonly password: string;
};

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: DEFAULT_PROXY_FORM.enabled,
  protocol: DEFAULT_PROXY_FORM.protocol,
  host: DEFAULT_PROXY_FORM.host,
  port: DEFAULT_PROXY_FORM.port,
  username: DEFAULT_PROXY_FORM.username,
  password: "",
};

const INVALID = "Invalid proxy configuration";
const MAX_HOST_LENGTH = 253;

function isProxyProtocol(value: unknown): value is ProxyProtocol {
  return typeof value === "string" && (PROXY_PROTOCOLS as readonly string[]).includes(value);
}

function invalid(message = INVALID): AppError {
  return new AppError("INVALID_ARGUMENT", message);
}

function normalizePort(raw: number): number {
  if (!Number.isInteger(raw) || raw < 1 || raw > 65535) throw invalid(INVALID);
  return raw;
}

function normalizeHost(raw: string): string {
  const host = raw.trim();
  if (!host || host.length > MAX_HOST_LENGTH) throw invalid(INVALID);
  if (/[\s/\\@]/u.test(host) || host.includes("://")) throw invalid(INVALID);
  return host;
}

function normalizeUsername(raw: string): string {
  const username = raw.trim();
  if (username.length > 255) throw invalid("Proxy username is too long");
  const hasControlCharacter = [...username].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
  if (hasControlCharacter) throw invalid(INVALID);
  return username;
}

function normalizePassword(raw: string): string {
  if (Buffer.byteLength(raw, "utf8") > 255) throw invalid("Proxy password is too long");
  return raw;
}

/** Validates non-secret fields and returns a normalized settings object. */
export function normalizeProxySettings(input: ProxyInput): ProxySettings {
  if (!isProxyProtocol(input.protocol)) throw invalid(INVALID);

  const host = normalizeHost(input.host);
  const port = normalizePort(input.port);
  const username = normalizeUsername(input.username);
  const password = normalizePassword(input.password ?? "");

  // Reuse the shared parser so schemes, host and port follow one contract.
  try {
    parseProxyServer(`${input.protocol}://${host}:${port}`);
  } catch {
    throw invalid(INVALID);
  }

  if (password && !username) throw invalid("Proxy username is required when a password is set");

  return { enabled: input.enabled, protocol: input.protocol, host, port, username, password };
}

export function proxyServerUrl(settings: ProxySettings): string {
  return `${settings.protocol}://${settings.host}:${settings.port}`;
}

/** Playwright receives credentials as separate fields, never inside the URL. */
export function toPlaywrightProxyConfig(settings: ProxySettings): PlaywrightProxy | undefined {
  if (!settings.enabled) return undefined;
  const parsed = parseProxyServer(proxyServerUrl(settings));
  const auth = settings.username
    ? { username: settings.username, password: settings.password }
    : {};
  return { server: parsed.server, ...auth };
}

/**
 * Identifies the active proxy so the controller can relaunch only when the
 * user really changed it. The value stays in memory and is never logged.
 */
export function proxyConfigurationKey(settings: ProxySettings): string {
  return [
    settings.enabled ? "1" : "0",
    settings.protocol,
    settings.host.toLowerCase(),
    String(settings.port),
    settings.username,
    settings.password ? "1" : "0",
    settings.password,
  ].join("|");
}

function toView(settings: ProxySettings, secureStorageAvailable: boolean): ProxySettingsView {
  return {
    enabled: settings.enabled,
    protocol: settings.protocol,
    host: settings.host,
    port: settings.port,
    username: secureStorageAvailable ? settings.username : "",
    hasPassword: secureStorageAvailable && settings.password.length > 0,
    secureStorageAvailable,
  };
}

function isProxyFile(value: unknown): value is ProxyFile {
  if (typeof value !== "object" || value === null) return false;
  const file = value as Partial<ProxyFile>;
  return (
    file.version === 1 &&
    typeof file.enabled === "boolean" &&
    isProxyProtocol(file.protocol) &&
    typeof file.host === "string" &&
    typeof file.port === "number" &&
    (file.credentials === undefined || typeof file.credentials === "string")
  );
}

async function parseCredentials(
  payload: string,
  codec: SecretCodec,
): Promise<StoredCredentials | undefined> {
  try {
    const parsed: unknown = JSON.parse(await codec.decrypt(payload));
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const credentials = parsed as Partial<StoredCredentials>;
    if (typeof credentials.username !== "string" || typeof credentials.password !== "string") {
      return undefined;
    }
    return { username: credentials.username, password: credentials.password };
  } catch {
    return undefined;
  }
}

/**
 * Manual proxy settings in `config/proxy.json`. Non-secret fields are plain
 * JSON; the username/password pair is only written when OS encryption is
 * available, and is dropped entirely when it is not.
 */
export class ProxySettingsStore {
  private readonly filePath: string;
  private readonly secrets: SecretCodec;

  constructor(filePath: string, deps: ProxyStoreDeps) {
    this.filePath = filePath;
    this.secrets = deps.secrets;
  }

  async load(): Promise<ProxySettings> {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_PROXY_SETTINGS;
      return DEFAULT_PROXY_SETTINGS;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_PROXY_SETTINGS;
    }
    if (!isProxyFile(parsed)) return DEFAULT_PROXY_SETTINGS;

    let settings: ProxySettings;
    try {
      settings = normalizeProxySettings({
        enabled: parsed.enabled,
        protocol: parsed.protocol,
        host: parsed.host,
        port: parsed.port,
        username: "",
        password: "",
      });
    } catch {
      return DEFAULT_PROXY_SETTINGS;
    }

    if (!parsed.credentials || !(await this.secrets.isAvailable())) return settings;
    const credentials = await parseCredentials(parsed.credentials, this.secrets);
    if (!credentials) return settings;

    try {
      return normalizeProxySettings({ ...settings, ...credentials });
    } catch {
      return settings;
    }
  }

  async getView(): Promise<ProxySettingsView> {
    return toView(await this.load(), await this.secrets.isAvailable());
  }

  async save(input: SaveProxySettingsRequest): Promise<ProxySettingsView> {
    const base = normalizeProxySettings({
      enabled: input.enabled,
      protocol: input.protocol,
      host: input.host,
      port: input.port,
      username: input.username,
      password: input.password ?? "",
    });
    const existing = await this.load();
    const username = base.username;
    let password = input.password === undefined ? existing.password : base.password;
    if (!username) password = "";

    const settings = normalizeProxySettings({ ...base, username, password });
    const credentials = await this.encryptCredentials(settings);
    const file: ProxyFile = {
      version: 1,
      enabled: settings.enabled,
      protocol: settings.protocol,
      host: settings.host,
      port: settings.port,
      ...(credentials ? { credentials } : {}),
    };
    this.write(file);

    const saved = credentials ? settings : { ...settings, username: "", password: "" };
    return toView(saved, await this.secrets.isAvailable());
  }

  private async encryptCredentials(settings: ProxySettings): Promise<string | undefined> {
    if (!settings.username) return undefined;
    if (!(await this.secrets.isAvailable())) return undefined;
    return this.secrets.encrypt(
      JSON.stringify({ username: settings.username, password: settings.password }),
    );
  }

  private write(file: ProxyFile): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(file, null, 2));
    fs.renameSync(temporary, this.filePath);
  }
}
