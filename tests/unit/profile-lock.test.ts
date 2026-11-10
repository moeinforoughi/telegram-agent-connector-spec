import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  acquireProfileLock,
  readProfileLock,
  releaseProfileLock,
} from "../../src/core/browser/profile-lock";
import { accountProfileDir, ensureAccountProfileDir } from "../../src/core/browser/profile-paths";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-lock-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("profile paths", () => {
  it("builds the profile under the account id", () => {
    expect(accountProfileDir(root, "11111111-2222-3333-4444-555555555555")).toBe(
      path.join(root, "11111111-2222-3333-4444-555555555555", "chromium-user-data"),
    );
  });

  it("creates the directory and rejects path traversal", () => {
    const created = ensureAccountProfileDir(root, "account-1");
    expect(fs.existsSync(created)).toBe(true);
    expect(fs.existsSync(path.join(created, "..", "chromium-user-data"))).toBe(true);

    expect(() => ensureAccountProfileDir(root, "..")).toThrow("Invalid account id");
    expect(() => ensureAccountProfileDir(root, "a/b")).toThrow("Invalid account id");
  });
});

describe("profile lock", () => {
  it("writes and reads a lock for the current process", () => {
    const lockPath = path.join(root, "profile.lock");

    acquireProfileLock(lockPath, 4242, "2026-11-10T00:00:00.000Z");

    expect(readProfileLock(lockPath)).toEqual({
      pid: 4242,
      createdAt: "2026-11-10T00:00:00.000Z",
    });
  });

  it("refuses a second lock held by a live process", () => {
    const lockPath = path.join(root, "profile.lock");
    acquireProfileLock(lockPath, process.pid);

    expect(() => acquireProfileLock(lockPath, process.pid)).toThrow("Profile is locked");
  });

  it("takes over a lock whose process is gone", () => {
    const lockPath = path.join(root, "profile.lock");
    acquireProfileLock(lockPath, 2_147_483_647);

    acquireProfileLock(lockPath, process.pid);

    expect(readProfileLock(lockPath)?.pid).toBe(process.pid);
  });

  it("takes over a malformed lock", () => {
    const lockPath = path.join(root, "profile.lock");
    fs.writeFileSync(lockPath, "not json");

    acquireProfileLock(lockPath, process.pid);

    expect(readProfileLock(lockPath)?.pid).toBe(process.pid);
  });

  it("releases only the caller's lock", () => {
    const lockPath = path.join(root, "profile.lock");
    acquireProfileLock(lockPath, 4242);

    releaseProfileLock(lockPath, 999_999);
    expect(fs.existsSync(lockPath)).toBe(true);

    releaseProfileLock(lockPath, 4242);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("does not throw when releasing a missing lock", () => {
    expect(() => releaseProfileLock(path.join(root, "missing.lock"))).not.toThrow();
  });

  it("keeps the profile directory when recovering a stale lock", () => {
    const profile = ensureAccountProfileDir(root, "account-1");
    fs.writeFileSync(path.join(profile, "sentinel"), "keep");
    const lockPath = path.join(root, "account-1", "profile.lock");
    acquireProfileLock(lockPath, 2_147_483_647);

    acquireProfileLock(lockPath, process.pid);

    expect(fs.existsSync(path.join(profile, "sentinel"))).toBe(true);
  });
});
