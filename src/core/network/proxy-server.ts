import { AppError } from "../../shared/errors";

export type ProxyCredentials = {
  readonly username: string;
  readonly password: string;
};

export type ParsedProxy = {
  readonly server: string;
  readonly requiresAuthentication: boolean;
  readonly credentials?: ProxyCredentials;
};

/** Shape of Playwright's `proxy` option; credentials stay out of the URL. */
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
  if (url.username === "") return { server, requiresAuthentication: false };

  return {
    server,
    requiresAuthentication: true,
    credentials: {
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    },
  };
}
