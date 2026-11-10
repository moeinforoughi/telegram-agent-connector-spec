import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors";

const SAFE_ACCOUNT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i;

export function accountProfileDir(profilesRoot: string, accountId: string): string {
  if (!SAFE_ACCOUNT_ID.test(accountId)) {
    throw new AppError("INTERNAL_ERROR", "Invalid account id");
  }
  return path.join(profilesRoot, accountId, "chromium-user-data");
}

export function ensureAccountProfileDir(profilesRoot: string, accountId: string): string {
  const directory = accountProfileDir(profilesRoot, accountId);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}
