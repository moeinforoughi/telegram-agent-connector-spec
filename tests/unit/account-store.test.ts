import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AccountStore } from "../../src/core/account/account-store";

let root: string;
let file: string;
let profilesRoot: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "tac-store-"));
  file = path.join(root, "config", "accounts.json");
  profilesRoot = path.join(root, "profiles");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function store(): AccountStore {
  return new AccountStore(file, profilesRoot, {
    now: () => new Date("2026-11-10T10:00:00.000Z"),
    id: () => "11111111-2222-3333-4444-555555555555",
  });
}

describe("AccountStore", () => {
  it("returns an empty list when the file does not exist", () => {
    expect(store().load()).toEqual([]);
    expect(store().getFirst()).toBeUndefined();
  });

  it("creates one account with a generated id and profile directory", () => {
    const created = store().create();

    expect(created).toMatchObject({
      id: "11111111-2222-3333-4444-555555555555",
      label: "Account 1",
      createdAt: "2026-11-10T10:00:00.000Z",
    });
    expect(created.profileDir).toBe(
      path.join(profilesRoot, "11111111-2222-3333-4444-555555555555", "chromium-user-data"),
    );
    expect(fs.existsSync(created.profileDir)).toBe(true);
    expect(store().load()).toHaveLength(1);
  });

  it("persists the account atomically and reloads it", () => {
    store().create();
    const reloaded = new AccountStore(file, profilesRoot).load();

    expect(reloaded).toHaveLength(1);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  it("updates lastConnectedAt without changing other fields", () => {
    const account = store().create();
    store().updateLastConnected(account.id, "2026-11-10T11:00:00.000Z");

    expect(store().getFirst()?.lastConnectedAt).toBe("2026-11-10T11:00:00.000Z");
  });

  it("removes metadata but leaves the profile files alone", () => {
    const account = store().create();
    store().remove(account.id);

    expect(store().load()).toEqual([]);
    expect(fs.existsSync(account.profileDir)).toBe(true);
  });

  it("refuses to overwrite a corrupted store", () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{ not json");

    expect(() => store().load()).toThrow("Account store is corrupted");
    expect(fs.readFileSync(file, "utf8")).toBe("{ not json");
  });

  it("rejects entries that do not have the required fields", () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([{ id: "x" }]));

    expect(() => store().load()).toThrow("Account store is corrupted");
  });

  it("keeps the stored profile path out of logs and views", () => {
    const account = store().create();
    expect(JSON.parse(JSON.stringify(account)).profileDir).toBe(account.profileDir);
    expect(Object.keys(account)).not.toContain("session");
  });
});
