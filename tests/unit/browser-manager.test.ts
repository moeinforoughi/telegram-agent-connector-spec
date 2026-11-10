import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserManager } from "../../src/core/browser/browser-manager";
import type { BrowserLauncher } from "../../src/core/browser/browser-types";
import { readProfileLock } from "../../src/core/browser/profile-lock";

type FakeContext = {
  pages: ReturnType<typeof vi.fn>;
  newPage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  emitClose: () => void;
};

function fakeContext(page: Page): FakeContext {
  const listeners = new Map<string, () => void>();
  const context: FakeContext = {
    pages: vi.fn(() => [page]),
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => {
      listeners.get("close")?.();
    }),
    on: vi.fn((event: string, handler: () => void) => {
      listeners.set(event, handler);
    }),
    emitClose: () => listeners.get("close")?.(),
  };
  return context;
}

let root: string;
let lockPath: string;
let profileDir: string;
let page: Page;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-browser-"));
  profileDir = path.join(root, "chromium-user-data");
  lockPath = path.join(root, "profile.lock");
  fs.mkdirSync(profileDir, { recursive: true });
  page = { on: vi.fn(), bringToFront: vi.fn(async () => undefined) } as unknown as Page;
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("BrowserManager", () => {
  it("launches with the profile and proxy, then releases the lock on close", async () => {
    const context = fakeContext(page);
    const launcher = vi.fn<BrowserLauncher>(async () => context as unknown as BrowserContext);
    const manager = new BrowserManager({ launcher });

    const launched = await manager.launch({
      profileDir,
      lockPath,
      proxy: { server: "http://127.0.0.1:8080" },
    });

    expect(launched).toBe(page);
    expect(launcher).toHaveBeenCalledWith({
      profileDir,
      proxy: { server: "http://127.0.0.1:8080" },
    });
    expect(readProfileLock(lockPath)?.pid).toBe(process.pid);

    await manager.close();

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(lockPath)).toBe(false);
    expect(manager.running).toBe(false);
  });

  it("reuses the first page instead of opening another", async () => {
    const context = fakeContext(page);
    const manager = new BrowserManager({
      launcher: async () => context as unknown as BrowserContext,
    });

    await manager.launch({ profileDir, lockPath });

    expect(context.pages).toHaveBeenCalled();
    expect(context.newPage).not.toHaveBeenCalled();
  });

  it("refuses a concurrent launch for the same profile", async () => {
    const context = fakeContext(page);
    const launcher = vi.fn<BrowserLauncher>(async () => context as unknown as BrowserContext);
    const manager = new BrowserManager({ launcher });
    await manager.launch({ profileDir, lockPath });

    const second = new BrowserManager({ launcher });
    await expect(second.launch({ profileDir, lockPath })).rejects.toThrow("Profile is locked");
    expect(launcher).toHaveBeenCalledTimes(1);
  });

  it("releases the lock and maps an unknown launch failure", async () => {
    const failure = new Error("spawn failed with a secret path");
    const manager = new BrowserManager({
      launcher: async () => {
        throw failure;
      },
    });

    await expect(manager.launch({ profileDir, lockPath })).rejects.toMatchObject({
      code: "BROWSER_LAUNCH_FAILED",
      message: "Browser launch failed",
    });
    expect(fs.existsSync(lockPath)).toBe(false);
    expect(manager.running).toBe(false);
  });

  it("clears the session and lock when the context closes unexpectedly", async () => {
    const context = fakeContext(page);
    const onClosed = vi.fn();
    const manager = new BrowserManager({
      launcher: async () => context as unknown as BrowserContext,
      onClosed,
    });
    await manager.launch({ profileDir, lockPath });

    context.emitClose();

    expect(manager.running).toBe(false);
    expect(fs.existsSync(lockPath)).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("allows a new launch after closing", async () => {
    const context = fakeContext(page);
    let calls = 0;
    const manager = new BrowserManager({
      launcher: async () => {
        calls += 1;
        return context as unknown as BrowserContext;
      },
    });
    await manager.launch({ profileDir, lockPath });
    await manager.close();
    await manager.launch({ profileDir, lockPath });

    expect(calls).toBe(2);
    expect(manager.running).toBe(true);
  });

  it("is idempotent when closed twice", async () => {
    const context = fakeContext(page);
    const manager = new BrowserManager({
      launcher: async () => context as unknown as BrowserContext,
    });
    await manager.launch({ profileDir, lockPath });
    await manager.close();
    await manager.close();

    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
