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

function store(ids: readonly string[] = ["11111111-2222-3333-4444-555555555555"]): AccountStore {
  let index = 0;
  return new AccountStore(file, profilesRoot, {
    now: () => new Date("2026-11-10T10:00:00.000Z"),
    id: () => ids[index++] ?? `generated-${index}`,
  });
}

function backups(): string[] {
  return fs
    .readdirSync(path.dirname(file))
    .filter((name) => name.startsWith("accounts.json.corrupt-"));
}

describe("AccountStore", () => {
  it("returns an empty list when the file does not exist", () => {
    expect(store().list()).toEqual([]);
    expect(store().getFirst()).toBeUndefined();
    expect(store().getById("missing")).toBeUndefined();
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

  it("creates and lists three isolated accounts", () => {
    const ids = [
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
    ];
    const subject = store(ids);

    const first = subject.create("Personal");
    const second = subject.create("Work");
    const third = subject.create("Test");

    expect(subject.list().map((account) => account.label)).toEqual(["Personal", "Work", "Test"]);
    expect(new Set(subject.list().map((account) => account.profileDir)).size).toBe(3);
    expect(subject.getById(first.id)?.label).toBe("Personal");
    expect(subject.getById(second.id)?.profileDir).not.toBe(first.profileDir);
    expect(subject.getById(third.id)?.profileDir).not.toBe(second.profileDir);
    for (const account of subject.list()) {
      expect(fs.existsSync(account.profileDir)).toBe(true);
    }
  });

  it("persists atomically and reloads all accounts", () => {
    const subject = store(["11111111-1111-1111-1111-111111111111"]);
    subject.create("One");
    const reloaded = new AccountStore(file, profilesRoot).load();

    expect(reloaded).toHaveLength(1);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  it("renames an account without changing its id or profile", () => {
    const subject = store();
    const account = subject.create("Old");

    const renamed = subject.rename(account.id, "  New label  ");

    expect(renamed).toMatchObject({ id: account.id, label: "New label" });
    expect(subject.getById(account.id)?.profileDir).toBe(account.profileDir);
    expect(subject.rename("missing", "x")).toBeUndefined();
  });

  it("rejects empty and over-long labels", () => {
    const subject = store();
    const account = subject.create();

    expect(() => subject.rename(account.id, "   ")).toThrow(/label is required/);
    expect(() => subject.rename(account.id, "x".repeat(81))).toThrow(/too long/);
    expect(() => subject.create("")).toThrow(/label is required/);
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

  it("backs up a corrupt registry and recovers with an empty list", () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{ not json");

    expect(store().load()).toEqual([]);
    expect(fs.existsSync(file)).toBe(false);
    expect(backups()).toHaveLength(1);
    const backup = backups()[0];
    if (!backup) throw new Error("Missing corrupt backup");
    expect(fs.readFileSync(path.join(path.dirname(file), backup), "utf8")).toBe("{ not json");
  });

  it("backs up a registry with invalid entries or a foreign profile path", () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([{ id: "x" }]));
    expect(store().load()).toEqual([]);
    expect(backups()).toHaveLength(1);

    fs.writeFileSync(
      file,
      JSON.stringify([
        {
          id: "11111111-1111-1111-1111-111111111111",
          label: "Injected",
          profileDir: "C:\\outside",
          createdAt: "2026-11-10T10:00:00.000Z",
        },
      ]),
    );
    expect(store().load()).toEqual([]);
    expect(backups()).toHaveLength(2);
  });

  it("keeps the stored profile path out of logs and views", () => {
    const account = store().create();
    expect(JSON.parse(JSON.stringify(account)).profileDir).toBe(account.profileDir);
    expect(Object.keys(account)).not.toContain("session");
  });
});
