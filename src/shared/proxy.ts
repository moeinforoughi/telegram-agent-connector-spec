/**
 * Renderer-safe proxy types. Credentials are never part of the view: the
 * renderer only learns whether a password is stored, never its value.
 */

export const PROXY_PROTOCOLS = ["socks5", "http"] as const;

export type ProxyProtocol = (typeof PROXY_PROTOCOLS)[number];

/**
 * Editable initial values. They are defaults only; connection logic never
 * hardcodes a proxy, vendor, or port.
 */
export const DEFAULT_PROXY_FORM = {
  enabled: false,
  protocol: "socks5",
  host: "127.0.0.1",
  port: 10808,
  username: "",
} as const;

export type ProxySettingsView = {
  readonly enabled: boolean;
  readonly protocol: ProxyProtocol;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly hasPassword: boolean;
  readonly secureStorageAvailable: boolean;
};

export type SaveProxySettingsRequest = {
  readonly enabled: boolean;
  readonly protocol: ProxyProtocol;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  /** `undefined` keeps the stored password; an empty string clears it. */
  readonly password?: string;
};

export type ProxyTestRequest = {
  readonly protocol: ProxyProtocol;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
};

export const PROXY_TEST_STATUSES = [
  "success",
  "proxy_unavailable",
  "connection_refused",
  "timeout",
  "auth_failed",
  "invalid_config",
] as const;

export type ProxyTestStatus = (typeof PROXY_TEST_STATUSES)[number];

export type ProxyTestResult = {
  readonly status: ProxyTestStatus;
  readonly message: string;
  readonly latencyMs?: number;
};
