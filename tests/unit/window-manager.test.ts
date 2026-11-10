import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const app = { isPackaged: false };
  const setWindowOpenHandler = vi.fn((_details?: unknown) => ({ action: "deny" }));
  const on = vi.fn();
  const once = vi.fn();
  const setPermissionCheckHandler = vi.fn();
  const setPermissionRequestHandler = vi.fn();
  const loadURL = vi.fn(async () => undefined);
  const loadFile = vi.fn(async () => undefined);
  const instance = {
    once,
    loadURL,
    loadFile,
    webContents: {
      setWindowOpenHandler,
      on,
      getURL: vi.fn(() => "file:///app/index.html"),
      session: { setPermissionCheckHandler, setPermissionRequestHandler },
    },
  };
  const BrowserWindow = vi.fn(function (_options?: unknown) {
    return instance;
  });
  return {
    app,
    BrowserWindow,
    instance,
    setWindowOpenHandler,
    on,
    once,
    setPermissionCheckHandler,
    setPermissionRequestHandler,
  };
});

vi.mock("electron", () => ({
  BrowserWindow: mocks.BrowserWindow,
  app: mocks.app,
}));

import { createMainWindow, loadRenderer } from "../../src/main/window-manager";

beforeEach(() => {
  mocks.app.isPackaged = false;
  delete process.env.ELECTRON_RENDERER_URL;
  mocks.BrowserWindow.mockClear();
  mocks.setWindowOpenHandler.mockClear();
  mocks.on.mockClear();
  mocks.once.mockClear();
  mocks.setPermissionCheckHandler.mockClear();
  mocks.setPermissionRequestHandler.mockClear();
  mocks.instance.loadURL.mockClear();
  mocks.instance.loadFile.mockClear();
});

describe("createMainWindow", () => {
  it("constructs the window with secure preferences", () => {
    const window = createMainWindow("C:\\preload.js");

    const options = mocks.BrowserWindow.mock.calls[0]?.[0] as {
      webPreferences?: Record<string, unknown>;
    };
    expect(options.webPreferences).toMatchObject({
      preload: "C:\\preload.js",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
    });
    expect(window).toBe(mocks.instance);
  });

  it("denies permissions, new windows, and unexpected navigation", () => {
    createMainWindow("C:\\preload.js");

    expect(mocks.setPermissionCheckHandler).toHaveBeenCalledTimes(1);
    const checkHandler = mocks.setPermissionCheckHandler.mock.calls[0]?.[0] as () => boolean;
    expect(checkHandler()).toBe(false);

    expect(mocks.setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    const requestHandler = mocks.setPermissionRequestHandler.mock.calls[0]?.[0] as (
      _webContents: unknown,
      _permission: unknown,
      callback: (granted: boolean) => void,
    ) => void;
    const callback = vi.fn();
    requestHandler({}, "media", callback);
    expect(callback).toHaveBeenCalledWith(false);

    expect(mocks.setWindowOpenHandler).toHaveBeenCalledTimes(1);
    const openHandler = mocks.setWindowOpenHandler.mock.calls[0]?.[0] as () => {
      action: string;
    };
    expect(openHandler()).toEqual({ action: "deny" });

    expect(mocks.on).toHaveBeenCalledWith("will-frame-navigate", expect.any(Function));
    expect(mocks.on).toHaveBeenCalledWith("will-redirect", expect.any(Function));
  });
});

describe("loadRenderer", () => {
  it("uses an allowed local dev server URL when unpackaged", async () => {
    process.env.ELECTRON_RENDERER_URL = "http://localhost:5173/";

    await loadRenderer(mocks.instance as unknown as BrowserWindow);

    expect(mocks.instance.loadURL).toHaveBeenCalledWith("http://localhost:5173/");
    expect(mocks.instance.loadFile).not.toHaveBeenCalled();
  });

  it("ignores the dev server URL in a packaged build", async () => {
    process.env.ELECTRON_RENDERER_URL = "http://localhost:5173/";
    mocks.app.isPackaged = true;

    await loadRenderer(mocks.instance as unknown as BrowserWindow);

    expect(mocks.instance.loadURL).not.toHaveBeenCalled();
    expect(mocks.instance.loadFile).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-local dev server URL", async () => {
    process.env.ELECTRON_RENDERER_URL = "https://evil.example/";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await loadRenderer(mocks.instance as unknown as BrowserWindow);

    expect(log).toHaveBeenCalledWith("[main] ignored an invalid ELECTRON_RENDERER_URL");
    expect(mocks.instance.loadURL).not.toHaveBeenCalled();
    expect(mocks.instance.loadFile).toHaveBeenCalledTimes(1);
  });
});
