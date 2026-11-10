import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDataPaths,
  ensureDataPaths,
  resolveDefaultUserDataRoot,
  resolveUserDataRoot,
} from "../../src/main/paths";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tac-paths-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveDefaultUserDataRoot", () => {
  it("places app data under LOCALAPPDATA on Windows", () => {
    const localAppData = "C:\\Users\\test\\AppData\\Local";

    expect(resolveDefaultUserDataRoot({ LOCALAPPDATA: localAppData }, "C:\\fallback")).toBe(
      path.join(localAppData, "UnofficialTelegramAgentConnector"),
    );
  });

  it("falls back when LOCALAPPDATA is missing or relative", () => {
    expect(resolveDefaultUserDataRoot({}, "C:\\fallback")).toBe("C:\\fallback");
    expect(resolveDefaultUserDataRoot({ LOCALAPPDATA: "relative" }, "C:\\fallback")).toBe(
      "C:\\fallback",
    );
  });
});

describe("resolveUserDataRoot", () => {
  it("accepts an absolute test override", () => {
    const override = makeTempDir();

    expect(resolveUserDataRoot({ CONNECTOR_USER_DATA_DIR: override }, "C:\\fallback")).toBe(
      override,
    );
  });

  it("ignores blank and relative overrides", () => {
    expect(resolveUserDataRoot({ CONNECTOR_USER_DATA_DIR: "  " }, "C:\\fallback")).toBe(
      "C:\\fallback",
    );
    expect(resolveUserDataRoot({ CONNECTOR_USER_DATA_DIR: "relative" }, "C:\\fallback")).toBe(
      "C:\\fallback",
    );
  });

  it("ignores the absolute override when overrides are disabled", () => {
    const override = makeTempDir();

    expect(resolveUserDataRoot({ CONNECTOR_USER_DATA_DIR: override }, "C:\\fallback", false)).toBe(
      "C:\\fallback",
    );
  });
});

describe("data paths", () => {
  it("builds every path below the user data root", () => {
    const root = makeTempDir();

    expect(buildDataPaths(root)).toEqual({
      root,
      config: path.join(root, "config"),
      profiles: path.join(root, "profiles"),
      logs: path.join(root, "logs"),
      cache: path.join(root, "cache"),
      backups: path.join(root, "backups"),
    });
  });

  it("creates the data directories", () => {
    const paths = buildDataPaths(makeTempDir());

    ensureDataPaths(paths);

    for (const dir of [paths.config, paths.profiles, paths.logs, paths.cache, paths.backups]) {
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    }
  });
});
