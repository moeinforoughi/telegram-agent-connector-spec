import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors";

export type ProfileLockInfo = {
  readonly pid: number;
  readonly createdAt: string;
};

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function readProfileLock(lockPath: string): ProfileLockInfo | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as ProfileLockInfo).pid === "number" &&
      typeof (parsed as ProfileLockInfo).createdAt === "string"
    ) {
      return parsed as ProfileLockInfo;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLock(lockPath: string, pid: number, createdAt: string): void {
  fs.writeFileSync(lockPath, JSON.stringify({ pid, createdAt }), { flag: "wx" });
}

/**
 * App-level lock in addition to Chromium's own SingletonLock. A lock owned by a
 * live process is never removed. A stale lock is replaced and the profile is
 * left intact so recovery does not destroy the session.
 */
export function acquireProfileLock(
  lockPath: string,
  pid: number = process.pid,
  createdAt: string = new Date().toISOString(),
): void {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  try {
    writeLock(lockPath, pid, createdAt);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  const existing = readProfileLock(lockPath);
  if (existing && isProcessAlive(existing.pid)) {
    throw new AppError("PROFILE_LOCKED", "Profile is locked by another process");
  }

  fs.rmSync(lockPath, { force: true });
  try {
    writeLock(lockPath, pid, createdAt);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new AppError("PROFILE_LOCKED", "Profile is locked by another process");
    }
    throw error;
  }
}

export function releaseProfileLock(lockPath: string, pid: number = process.pid): void {
  const existing = readProfileLock(lockPath);
  if (existing && existing.pid !== pid) return;
  fs.rmSync(lockPath, { force: true });
}
