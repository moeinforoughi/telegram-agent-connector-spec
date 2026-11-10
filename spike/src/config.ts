import path from "node:path";

const root = process.cwd();

export const config = {
  root,
  profileDir:
    process.env.SPIKE_PROFILE_DIR ??
    path.join(root, "profiles", "spike-account", "chromium-user-data"),
  proxyServer: process.env.SPIKE_PROXY?.trim() || undefined,
  telegramUrl: "https://web.telegram.org/",
  logsDir: path.join(root, "logs"),
  loginTimeoutMs: Number(process.env.SPIKE_LOGIN_TIMEOUT_SEC ?? 900) * 1000,
  navigationTimeoutMs: 60_000,
} as const;
