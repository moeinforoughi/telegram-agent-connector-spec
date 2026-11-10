import { AppError } from "../../shared/errors";
import { readWindowsProxy } from "./windows-proxy";

export type ProxySource = "manual" | "phase0" | "windows" | "environment" | "direct";

export type ProxyMode = "proxy" | "direct";

export type ProxyCredentials = {
  readonly username: string;
  readonly password: string;
};

export type ProxyResolution = {
  readonly source: ProxySource;
  readonly mode: ProxyMode;
  readonly requiresAuthentication: boolean;
  readonly server?: string;
  readonly bypass?: readonly string[];
  /** Kept out of logs, IPC, and persisted settings. */
  readonly credentials?: ProxyCredentials;
};

export type WindowsProxySettings = {
  readonly enabled: boolean;
  readonly server?: string;
  readonly bypass?: string;
};

export type ProxyInputs = {
  readonly manual?: string;
  readonly phase0?: string;
  readonly env?: NodeJS.ProcessEnv;
  /** Pass `null` when the Windows registry was checked and had no proxy. */
  readonly windows?: WindowsProxySettings | null;
};

export type ParsedProxy = {
  readonly server: string;
  readonly requiresAuthentication: boolean;
  readonly credentials?: ProxyCredentials;
};

export type PlaywrightProxy = {
  readonly server: string;
  readonly bypass?: string;
  readonly username?: string;
  readonly password?: string;
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "socks5:"]);
const INVALID_PROXY = "Invalid proxy server";

export function parseProxyServer(raw: string): ParsedProxy {
  const trimmed = raw.trim();
  if (!trimmed) throw new AppError("PROXY_ERROR", INVALID_PROXY);

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new AppError("PROXY_ERROR", INVALID_PROXY);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol) || !url.hostname || !url.port) {
    throw new AppError("PROXY_ERROR", INVALID_PROXY);
  }
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) {
    throw new AppError("PROXY_ERROR", INVALID_PROXY);
  }

  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AppError("PROXY_ERROR", INVALID_PROXY);
  }

  const server = `${url.protocol}//${url.hostname}:${url.port}`;
  const hasUser = url.username !== "";
  if (!hasUser) return { server, requiresAuthentication: false };

  return {
    server,
    requiresAuthentication: true,
    credentials: {
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    },
  };
}

/** Strips credentials so a proxy URL can be logged safely. */
export function redactProxyServer(server: string): string {
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(server) ? server : `http://${server}`);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
  } catch {
    return "[invalid proxy]";
  }
}

export function describeProxy(resolution: ProxyResolution): string {
  const parts = [`source=${resolution.source}`, `mode=${resolution.mode}`];
  if (resolution.server) parts.push(`server=${redactProxyServer(resolution.server)}`);
  parts.push(`auth=${resolution.requiresAuthentication ? "yes" : "no"}`);
  return parts.join(" ");
}

export function toPlaywrightProxy(resolution: ProxyResolution): PlaywrightProxy | undefined {
  if (resolution.mode !== "proxy" || !resolution.server) return undefined;
  return {
    server: resolution.server,
    ...(resolution.bypass && resolution.bypass.length > 0
      ? { bypass: resolution.bypass.join(",") }
      : {}),
    ...(resolution.credentials
      ? { username: resolution.credentials.username, password: resolution.credentials.password }
      : {}),
  };
}

function parseBypass(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const entries = raw
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? entries : undefined;
}

function proxyResolution(
  source: ProxySource,
  parsed: ParsedProxy,
  bypass: string[] | undefined,
): ProxyResolution {
  return {
    source,
    mode: "proxy",
    requiresAuthentication: parsed.requiresAuthentication,
    server: parsed.server,
    ...(bypass ? { bypass } : {}),
    ...(parsed.credentials ? { credentials: parsed.credentials } : {}),
  };
}

function selectWindowsServer(raw: string): string {
  const entries = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 1 && !entries[0]?.includes("=")) return entries[0] ?? raw;

  const byScheme = new Map<string, string>();
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator < 1) continue;
    const key = entry.slice(0, separator).trim().toLowerCase();
    const value = entry.slice(separator + 1).trim();
    if (value) byScheme.set(key, value);
  }

  const chosen =
    byScheme.get("https") ??
    byScheme.get("http") ??
    byScheme.get("socks") ??
    byScheme.get("socks5");
  if (!chosen) return raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(chosen)) return chosen;
  if (byScheme.get("socks") === chosen || byScheme.get("socks5") === chosen) {
    return `socks5://${chosen}`;
  }
  return `${byScheme.get("https") === chosen ? "https" : "http"}://${chosen}`;
}

const ENV_KEYS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
] as const;

/**
 * Priority: manual -> Phase 0 -> Windows registry -> environment -> direct.
 * An invalid explicit source raises PROXY_ERROR; it never falls back silently.
 */
export function resolveProxy(inputs: ProxyInputs): ProxyResolution {
  if (inputs.manual?.trim()) {
    return proxyResolution("manual", parseProxyServer(inputs.manual), undefined);
  }
  if (inputs.phase0?.trim()) {
    return proxyResolution("phase0", parseProxyServer(inputs.phase0), undefined);
  }

  const windows = inputs.windows ?? null;
  if (windows?.enabled) {
    if (!windows.server?.trim()) throw new AppError("PROXY_ERROR", INVALID_PROXY);
    const parsed = parseProxyServer(selectWindowsServer(windows.server));
    return proxyResolution("windows", parsed, parseBypass(windows.bypass));
  }

  const env = inputs.env ?? {};
  const bypass = parseBypass(env.NO_PROXY ?? env.no_proxy);
  let sawEnvironmentProxy = false;
  for (const key of ENV_KEYS) {
    const value = env[key]?.trim();
    if (!value) continue;
    sawEnvironmentProxy = true;
    try {
      return proxyResolution("environment", parseProxyServer(value), bypass);
    } catch {
      // Try the next configured variable before reporting the whole source invalid.
    }
  }
  if (sawEnvironmentProxy) throw new AppError("PROXY_ERROR", INVALID_PROXY);

  return { source: "direct", mode: "direct", requiresAuthentication: false };
}

/** Production entry point: reads the real Windows registry once per launch. */
export function resolveSystemProxy(
  env: NodeJS.ProcessEnv = process.env,
  readWindows: () => WindowsProxySettings | null = readWindowsProxy,
): ProxyResolution {
  const manual = env.CONNECTOR_PROXY_SERVER?.trim();
  const phase0 = env.SPIKE_PROXY?.trim();
  if (manual || phase0) {
    return resolveProxy({
      ...(manual ? { manual } : {}),
      ...(phase0 ? { phase0 } : {}),
      env,
      windows: null,
    });
  }
  return resolveProxy({ env, windows: readWindows() });
}
