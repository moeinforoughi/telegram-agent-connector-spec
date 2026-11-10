import net from "node:net";
import { AppError } from "../../shared/errors";
import type { ProxyTestRequest, ProxyTestResult, ProxyTestStatus } from "../../shared/proxy";
import { normalizeProxySettings, type ProxySettings } from "./proxy-settings";

export type ProxyProbeTarget = {
  readonly host: string;
  readonly port: number;
};

export type ProxyProbeOptions = {
  readonly target?: ProxyProbeTarget;
  readonly timeoutMs?: number;
};

const DEFAULT_TARGET: ProxyProbeTarget = { host: "web.telegram.org", port: 443 };
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 16_384;

class ProbeFailure extends Error {
  readonly status: ProxyTestStatus;

  constructor(status: ProxyTestStatus, message: string) {
    super(message);
    this.name = "ProbeFailure";
    this.status = status;
  }
}

/** Buffered socket reader shared by the HTTP and SOCKS5 handshakes. */
class SocketReader {
  private buffer = Buffer.alloc(0);
  private waiter: (() => void) | undefined;
  private failure: Error | undefined;
  private ended = false;

  constructor(socket: net.Socket, timeoutMs: number) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.wake();
    });
    socket.on("error", (error: Error) => {
      this.failure = error;
      this.wake();
    });
    socket.on("close", () => {
      this.ended = true;
      this.wake();
    });
    socket.setTimeout(timeoutMs, () => {
      this.failure = new ProbeFailure("timeout", "Proxy connection timed out");
      socket.destroy();
      this.wake();
    });
  }

  async read(length: number): Promise<Buffer> {
    while (this.buffer.length < length) await this.waitForData();
    const chunk = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return Buffer.from(chunk);
  }

  async readUntil(marker: string): Promise<string> {
    for (;;) {
      const index = this.buffer.indexOf(marker);
      if (index >= 0) {
        const end = index + marker.length;
        const text = this.buffer.subarray(0, end).toString("latin1");
        this.buffer = this.buffer.subarray(end);
        return text;
      }
      if (this.buffer.length > MAX_RESPONSE_BYTES) {
        throw new ProbeFailure("proxy_unavailable", "Proxy response was too large");
      }
      await this.waitForData();
    }
  }

  private async waitForData(): Promise<void> {
    if (this.failure) throw this.failure;
    if (this.ended) throw new ProbeFailure("proxy_unavailable", "Proxy closed the connection");
    await new Promise<void>((resolve) => {
      this.waiter = resolve;
    });
  }

  private wake(): void {
    const waiter = this.waiter;
    this.waiter = undefined;
    waiter?.();
  }
}

function mapConnectError(error: NodeJS.ErrnoException): ProbeFailure {
  if (error.code === "ECONNREFUSED") {
    return new ProbeFailure("connection_refused", "Proxy refused the connection");
  }
  if (error.code === "ETIMEDOUT") {
    return new ProbeFailure("timeout", "Proxy connection timed out");
  }
  return new ProbeFailure("proxy_unavailable", "Proxy is unavailable");
}

function connectToProxy(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new ProbeFailure("timeout", "Proxy connection timed out"));
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.setTimeout(0);
      resolve(socket);
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      socket.destroy();
      reject(mapConnectError(error));
    });
  });
}

async function httpConnect(
  socket: net.Socket,
  settings: ProxySettings,
  target: ProxyProbeTarget,
  timeoutMs: number,
): Promise<void> {
  const reader = new SocketReader(socket, timeoutMs);
  const authorization = settings.username
    ? `Proxy-Authorization: Basic ${Buffer.from(
        `${settings.username}:${settings.password}`,
        "utf8",
      ).toString("base64")}\r\n`
    : "";
  socket.write(
    `CONNECT ${target.host}:${target.port} HTTP/1.1\r\n` +
      `Host: ${target.host}:${target.port}\r\n` +
      authorization +
      "Proxy-Connection: keep-alive\r\n\r\n",
  );

  const response = await reader.readUntil("\r\n\r\n");
  const statusLine = response.split("\r\n")[0] ?? "";
  const match = /^HTTP\/\d\.\d\s+(\d{3})/i.exec(statusLine);
  if (!match?.[1])
    throw new ProbeFailure("proxy_unavailable", "Proxy returned an invalid response");

  const status = Number(match[1]);
  if (status === 200) return;
  if (status === 401 || status === 407) {
    throw new ProbeFailure("auth_failed", "Proxy authentication failed");
  }
  throw new ProbeFailure("proxy_unavailable", `Proxy rejected the connection (HTTP ${status})`);
}

function encodeSocksAddress(host: string): Buffer {
  if (net.isIPv4(host)) {
    return Buffer.concat([Buffer.from([0x01]), Buffer.from(host.split(".").map(Number))]);
  }
  const name = Buffer.from(host, "utf8");
  if (name.length === 0 || name.length > 255) {
    throw new ProbeFailure("proxy_unavailable", "Proxy target address is invalid");
  }
  return Buffer.concat([Buffer.from([0x03, name.length]), name]);
}

function mapSocksReply(reply: number): ProbeFailure {
  if (reply === 0x05)
    return new ProbeFailure("connection_refused", "Proxy could not reach the target");
  switch (reply) {
    case 0x02:
      return new ProbeFailure("proxy_unavailable", "Proxy connection is not allowed by policy");
    case 0x03:
      return new ProbeFailure("proxy_unavailable", "Proxy reports network unreachable");
    case 0x04:
      return new ProbeFailure("proxy_unavailable", "Proxy reports host unreachable");
    case 0x06:
      return new ProbeFailure("proxy_unavailable", "Proxy reports TTL expired");
    case 0x07:
      return new ProbeFailure("proxy_unavailable", "Proxy does not support the CONNECT command");
    case 0x08:
      return new ProbeFailure(
        "proxy_unavailable",
        "Proxy does not support the target address type",
      );
    default:
      return new ProbeFailure("proxy_unavailable", "Proxy rejected the connection");
  }
}

async function readSocksBoundAddress(reader: SocketReader, addressType: number): Promise<void> {
  if (addressType === 0x01) {
    await reader.read(4);
  } else if (addressType === 0x04) {
    await reader.read(16);
  } else if (addressType === 0x03) {
    const [length] = await reader.read(1);
    await reader.read(length ?? 0);
  } else {
    throw new ProbeFailure("proxy_unavailable", "Proxy returned an invalid address type");
  }
  await reader.read(2);
}

async function socks5Connect(
  socket: net.Socket,
  settings: ProxySettings,
  target: ProxyProbeTarget,
  timeoutMs: number,
): Promise<void> {
  const reader = new SocketReader(socket, timeoutMs);
  const methods = settings.username ? [0x00, 0x02] : [0x00];
  socket.write(Buffer.from([0x05, methods.length, ...methods]));

  const greeting = await reader.read(2);
  if (greeting[0] !== 0x05) {
    throw new ProbeFailure("proxy_unavailable", "Proxy returned an invalid SOCKS5 response");
  }

  const method = greeting[1];
  if (method === 0xff) {
    throw new ProbeFailure("auth_failed", "Proxy rejected the offered authentication methods");
  }
  if (method === 0x02) {
    if (!settings.username) throw new ProbeFailure("auth_failed", "Proxy requires authentication");
    const username = Buffer.from(settings.username, "utf8");
    const password = Buffer.from(settings.password, "utf8");
    socket.write(
      Buffer.concat([
        Buffer.from([0x01, username.length]),
        username,
        Buffer.from([password.length]),
        password,
      ]),
    );
    const auth = await reader.read(2);
    if (auth[0] !== 0x01 || auth[1] !== 0x00) {
      throw new ProbeFailure("auth_failed", "Proxy authentication failed");
    }
  } else if (method !== 0x00) {
    throw new ProbeFailure("auth_failed", "Proxy requested an unsupported authentication method");
  }

  const port = Buffer.alloc(2);
  port.writeUInt16BE(target.port, 0);
  socket.write(
    Buffer.concat([Buffer.from([0x05, 0x01, 0x00]), encodeSocksAddress(target.host), port]),
  );

  const head = await reader.read(4);
  if (head[0] !== 0x05) {
    throw new ProbeFailure("proxy_unavailable", "Proxy returned an invalid SOCKS5 reply");
  }
  if (head[1] !== 0x00) throw mapSocksReply(head[1] ?? 0x01);
  await readSocksBoundAddress(reader, head[3] ?? 0x00);
}

/**
 * Opens a real TCP tunnel through the configured proxy to a target host
 * (`web.telegram.org:443` by default). An open port alone is not success: the
 * HTTP CONNECT or SOCKS5 CONNECT handshake must complete.
 */
export async function probeProxy(
  input: ProxyTestRequest,
  options: ProxyProbeOptions = {},
): Promise<ProxyTestResult> {
  let settings: ProxySettings;
  try {
    settings = normalizeProxySettings({
      enabled: true,
      protocol: input.protocol,
      host: input.host,
      port: input.port,
      username: input.username,
      password: input.password ?? "",
    });
  } catch (error) {
    return {
      status: "invalid_config",
      message: error instanceof AppError ? error.message : "Invalid proxy configuration",
    };
  }

  const target = options.target ?? DEFAULT_TARGET;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let socket: net.Socket | undefined;

  try {
    socket = await connectToProxy(settings.host, settings.port, timeoutMs);
    if (settings.protocol === "socks5") {
      await socks5Connect(socket, settings, target, timeoutMs);
    } else {
      await httpConnect(socket, settings, target, timeoutMs);
    }
    return {
      status: "success",
      message: `Proxy tunnel to ${target.host}:${target.port} established`,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const failure =
      error instanceof ProbeFailure
        ? error
        : new ProbeFailure("proxy_unavailable", "Proxy is unavailable");
    return {
      status: failure.status,
      message: failure.message,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    socket?.destroy();
  }
}
