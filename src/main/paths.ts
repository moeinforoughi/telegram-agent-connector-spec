import fs from "node:fs";
import path from "node:path";
import { PRODUCT_DATA_DIR } from "../shared/constants";
import type { DataPaths } from "../shared/types";

export function resolveDefaultUserDataRoot(env: NodeJS.ProcessEnv, fallback: string): string {
  const localAppData = env.LOCALAPPDATA?.trim();
  return localAppData && path.isAbsolute(localAppData)
    ? path.join(localAppData, PRODUCT_DATA_DIR)
    : fallback;
}

export function resolveUserDataRoot(
  env: NodeJS.ProcessEnv,
  fallback: string,
  allowOverride = true,
): string {
  if (!allowOverride) return fallback;
  const override = env.CONNECTOR_USER_DATA_DIR?.trim();
  return override && path.isAbsolute(override) ? override : fallback;
}

export function buildDataPaths(root: string): DataPaths {
  return {
    root,
    config: path.join(root, "config"),
    profiles: path.join(root, "profiles"),
    logs: path.join(root, "logs"),
    cache: path.join(root, "cache"),
    backups: path.join(root, "backups"),
  };
}

export function ensureDataPaths(paths: DataPaths): void {
  for (const dir of [paths.config, paths.profiles, paths.logs, paths.cache, paths.backups]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
