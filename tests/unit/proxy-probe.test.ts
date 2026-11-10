import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { probeProxy } from "../../src/core/network/proxy-probe";

type ProbeServer = {
  port: number;
  requests: string[];
  close: () => Promise<void>;
};

function trackSockets(server: net.Server): {
  sockets: Set<net.Socket>;
  close: () => Promise<void>;
} {
  const sockets = new Set<net.Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  return {
    sockets,
    close: () =>
      new Promise((done) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => done());
      }),
  };
}

function startHttpProxy(options: {
  status?: number;
  auth?: { username: string; password: string };
}): Promise<ProbeServer> {
  const requests: string[] = [];
  const server = http.createServer((_request, response) => {
    response.writeHead(405);
    response.end();
  });

  server.on("connect", (request, socket) => {
    requests.push(`${request.method ?? ""} ${request.url ?? ""}`);
    const expected = options.auth
      ? `Basic ${Buffer.from(`${options.auth.username}:${options.auth.password}`).toString("base64")}`
      : undefined;
    const status =
      expected && request.headers["proxy-authorization"] !== expected
        ? 407
        : (options.status ?? 200);
    socket.write(`HTTP/1.1 ${status} Test\r\n\r\n`);
    if (status !== 200) socket.destroy();
  });

  const graceful = trackSockets(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, requests, close: graceful.close });
    });
  });
}

function startSocks5Proxy(options: {
  auth?: { username: string; password: string };
  reply?: number;
}): Promise<ProbeServer> {
  const requests: string[] = [];
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let stage: "greeting" | "auth" | "connect" = "greeting";

    const pump = (): void => {
      if (stage === "greeting") {
        if (buffer.length < 2) return;
        const count = buffer[1] ?? 0;
        if (buffer.length < 2 + count) return;
        const methods = [...buffer.subarray(2, 2 + count)];
        buffer = buffer.subarray(2 + count);
        const selected = options.auth ? 0x02 : 0x00;
        if (!methods.includes(selected)) {
          socket.write(Buffer.from([0x05, 0xff]));
          socket.destroy();
          return;
        }
        socket.write(Buffer.from([0x05, selected]));
        stage = selected === 0x02 ? "auth" : "connect";
      }

      if (stage === "auth") {
        if (buffer.length < 2) return;
        const usernameLength = buffer[1] ?? 0;
        if (buffer.length < usernameLength + 3) return;
        const passwordLength = buffer[2 + usernameLength] ?? 0;
        if (buffer.length < usernameLength + passwordLength + 3) return;

        const username = buffer.subarray(2, 2 + usernameLength).toString("utf8");
        const password = buffer
          .subarray(3 + usernameLength, 3 + usernameLength + passwordLength)
          .toString("utf8");
        buffer = buffer.subarray(usernameLength + passwordLength + 3);

        const valid = username === options.auth?.username && password === options.auth?.password;
        socket.write(Buffer.from([0x01, valid ? 0x00 : 0x01]));
        if (!valid) {
          socket.destroy();
          return;
        }
        stage = "connect";
      }

      if (stage === "connect") {
        if (buffer.length < 5) return;
        const addressType = buffer[3];
        let length = 4;
        if (addressType === 0x01) {
          length += 4;
        } else if (addressType === 0x04) {
          length += 16;
        } else if (addressType === 0x03) {
          length += 1 + (buffer[4] ?? 0);
        } else {
          socket.destroy();
          return;
        }
        length += 2;
        if (buffer.length < length) return;

        requests.push("CONNECT");
        buffer = buffer.subarray(length);
        const reply = options.reply ?? 0;
        socket.write(Buffer.from([0x05, reply, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
        if (reply !== 0) socket.destroy();
      }
    };

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      pump();
    });
  });

  const graceful = trackSockets(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, requests, close: graceful.close });
    });
  });
}

function startSilentTcpServer(): Promise<ProbeServer> {
  const server = net.createServer(() => {
    // Accept and say nothing: an open port is not a working proxy.
  });
  const graceful = trackSockets(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, requests: [], close: graceful.close });
    });
  });
}

function closedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

const target = { host: "web.telegram.org", port: 443 };

describe("probeProxy", () => {
  it("succeeds through an HTTP CONNECT proxy", async () => {
    const proxy = await startHttpProxy({});
    try {
      const result = await probeProxy(
        { protocol: "http", host: "127.0.0.1", port: proxy.port, username: "" },
        { target, timeoutMs: 2_000 },
      );
      expect(result.status).toBe("success");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(proxy.requests[0]).toContain("CONNECT");
    } finally {
      await proxy.close();
    }
  });

  it("reports HTTP authentication failure", async () => {
    const proxy = await startHttpProxy({ auth: { username: "user", password: "secret" } });
    try {
      const bad = await probeProxy(
        { protocol: "http", host: "127.0.0.1", port: proxy.port, username: "" },
        { target, timeoutMs: 2_000 },
      );
      expect(bad.status).toBe("auth_failed");

      const good = await probeProxy(
        {
          protocol: "http",
          host: "127.0.0.1",
          port: proxy.port,
          username: "user",
          password: "secret",
        },
        { target, timeoutMs: 2_000 },
      );
      expect(good.status).toBe("success");
    } finally {
      await proxy.close();
    }
  });

  it("maps an HTTP rejection to proxy_unavailable", async () => {
    const proxy = await startHttpProxy({ status: 502 });
    try {
      const result = await probeProxy(
        { protocol: "http", host: "127.0.0.1", port: proxy.port, username: "" },
        { target, timeoutMs: 2_000 },
      );
      expect(result.status).toBe("proxy_unavailable");
    } finally {
      await proxy.close();
    }
  });

  it("succeeds through a SOCKS5 proxy without authentication", async () => {
    const proxy = await startSocks5Proxy({});
    try {
      const result = await probeProxy(
        { protocol: "socks5", host: "127.0.0.1", port: proxy.port, username: "" },
        { target, timeoutMs: 2_000 },
      );
      expect(result.status).toBe("success");
      expect(proxy.requests).toContain("CONNECT");
    } finally {
      await proxy.close();
    }
  });

  it("supports SOCKS5 username/password authentication", async () => {
    const proxy = await startSocks5Proxy({ auth: { username: "user", password: "secret" } });
    try {
      const bad = await probeProxy(
        {
          protocol: "socks5",
          host: "127.0.0.1",
          port: proxy.port,
          username: "user",
          password: "wrong",
        },
        { target, timeoutMs: 2_000 },
      );
      expect(bad.status).toBe("auth_failed");

      const good = await probeProxy(
        {
          protocol: "socks5",
          host: "127.0.0.1",
          port: proxy.port,
          username: "user",
          password: "secret",
        },
        { target, timeoutMs: 2_000 },
      );
      expect(good.status).toBe("success");
    } finally {
      await proxy.close();
    }
  });

  it("maps a SOCKS5 connection-refused reply", async () => {
    const proxy = await startSocks5Proxy({ reply: 0x05 });
    try {
      const result = await probeProxy(
        { protocol: "socks5", host: "127.0.0.1", port: proxy.port, username: "" },
        { target, timeoutMs: 2_000 },
      );
      expect(result.status).toBe("connection_refused");
    } finally {
      await proxy.close();
    }
  });

  it("reports a closed proxy port as connection_refused", async () => {
    const port = await closedPort();
    const result = await probeProxy(
      { protocol: "socks5", host: "127.0.0.1", port, username: "" },
      { target, timeoutMs: 2_000 },
    );
    expect(result.status).toBe("connection_refused");
  });

  it("times out when an open port does not speak the proxy protocol", async () => {
    const silent = await startSilentTcpServer();
    try {
      const result = await probeProxy(
        { protocol: "socks5", host: "127.0.0.1", port: silent.port, username: "" },
        { target, timeoutMs: 150 },
      );
      expect(result.status).toBe("timeout");
    } finally {
      await silent.close();
    }
  });

  it("returns invalid_config for malformed input without touching the network", async () => {
    const cases = [
      { protocol: "ftp", host: "127.0.0.1", port: 1080, username: "" },
      { protocol: "socks5", host: "bad host", port: 1080, username: "" },
      { protocol: "socks5", host: "127.0.0.1", port: 0, username: "" },
      { protocol: "socks5", host: "127.0.0.1", port: 1080, username: "", password: "x" },
    ] as const;
    for (const input of cases) {
      const result = await probeProxy(input as never, { target, timeoutMs: 100 });
      expect(result.status).toBe("invalid_config");
    }
  });
});
