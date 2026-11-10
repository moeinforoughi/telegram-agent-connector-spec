import net from "node:net";

export type TestSocksProxy = {
  port: number;
  close: () => Promise<void>;
};

/**
 * Minimal SOCKS5 server for integration tests. It accepts unauthenticated
 * clients and forwards every CONNECT to one fixed local target, so a test can
 * force Chromium through the proxy without real network access.
 */
export function startForwardingSocks5Proxy(forward: {
  host: string;
  port: number;
}): Promise<TestSocksProxy> {
  const sockets = new Set<net.Socket>();

  const server = net.createServer((client) => {
    sockets.add(client);
    client.on("close", () => sockets.delete(client));
    client.on("error", () => client.destroy());

    let buffer = Buffer.alloc(0);
    let stage: "greeting" | "request" | "forwarding" = "greeting";

    const pump = (): void => {
      if (stage === "greeting") {
        if (buffer.length < 2) return;
        const count = buffer[1] ?? 0;
        if (buffer.length < 2 + count) return;
        buffer = buffer.subarray(2 + count);
        client.write(Buffer.from([0x05, 0x00]));
        stage = "request";
      }

      if (stage === "request") {
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
          client.destroy();
          return;
        }
        length += 2;
        if (buffer.length < length) return;
        buffer = buffer.subarray(length);
        stage = "forwarding";

        const upstream = net.connect(forward.port, forward.host, () => {
          sockets.add(upstream);
          client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
          if (buffer.length > 0) upstream.write(buffer);
          buffer = Buffer.alloc(0);
          client.pipe(upstream);
          upstream.pipe(client);
        });
        upstream.on("close", () => sockets.delete(upstream));
        upstream.on("error", () => client.destroy());
      }
    };

    client.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      pump();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing proxy port");
      resolve({
        port: address.port,
        close: () =>
          new Promise((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}
