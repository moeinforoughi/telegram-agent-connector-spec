import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors";
import { accountProfileDir, ensureAccountProfileDir } from "../browser/profile-paths";

export type StoredAccount = {
  readonly id: string;
  readonly label: string;
  readonly profileDir: string;
  readonly createdAt: string;
  readonly lastConnectedAt?: string;
};

export type AccountStoreDeps = {
  readonly now?: () => Date;
  readonly id?: () => string;
};

const MAX_LABEL_LENGTH = 80;

function isStoredAccount(value: unknown): value is StoredAccount {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<StoredAccount>;
  return (
    typeof entry.id === "string" &&
    typeof entry.label === "string" &&
    typeof entry.profileDir === "string" &&
    typeof entry.createdAt === "string" &&
    (entry.lastConnectedAt === undefined || typeof entry.lastConnectedAt === "string")
  );
}

function normalizeLabel(raw: string): string {
  const label = raw.trim();
  if (!label) throw new AppError("INVALID_ARGUMENT", "Account label is required");
  if (label.length > MAX_LABEL_LENGTH) {
    throw new AppError("INVALID_ARGUMENT", "Account label is too long");
  }
  const hasControlCharacter = [...label].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
  if (hasControlCharacter) throw new AppError("INVALID_ARGUMENT", "Invalid account label");
  return label;
}

/**
 * Non-secret account metadata in a local JSON file. Session data stays in each
 * account's Chromium profile; cookies and tokens are never copied here.
 *
 * A corrupt registry is renamed to a backup and treated as empty. The original
 * bytes are never deleted, so recovery does not destroy user data.
 */
export class AccountStore {
  private readonly filePath: string;
  private readonly profilesRoot: string;
  private readonly now: () => Date;
  private readonly nextId: () => string;

  constructor(filePath: string, profilesRoot: string, deps: AccountStoreDeps = {}) {
    this.filePath = filePath;
    this.profilesRoot = profilesRoot;
    this.now = deps.now ?? (() => new Date());
    this.nextId = deps.id ?? (() => crypto.randomUUID());
  }

  list(): StoredAccount[] {
    return this.load();
  }

  load(): StoredAccount[] {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.recoverCorrupt(raw);
    }
    if (!Array.isArray(parsed) || !parsed.every(isStoredAccount)) {
      return this.recoverCorrupt(raw);
    }

    // The registry may not inject a profile path outside the managed root.
    const validPaths = parsed.every((account) => {
      try {
        return account.profileDir === accountProfileDir(this.profilesRoot, account.id);
      } catch {
        return false;
      }
    });
    if (!validPaths) return this.recoverCorrupt(raw);

    return parsed;
  }

  getFirst(): StoredAccount | undefined {
    return this.load()[0];
  }

  getById(id: string): StoredAccount | undefined {
    return this.load().find((account) => account.id === id);
  }

  create(label?: string): StoredAccount {
    const accounts = this.load();
    const id = this.nextId();
    const account: StoredAccount = {
      id,
      label: label === undefined ? `Account ${accounts.length + 1}` : normalizeLabel(label),
      profileDir: ensureAccountProfileDir(this.profilesRoot, id),
      createdAt: this.now().toISOString(),
    };
    this.save([...accounts, account]);
    return account;
  }

  rename(id: string, label: string): StoredAccount | undefined {
    const accounts = this.load();
    const index = accounts.findIndex((account) => account.id === id);
    if (index < 0) return undefined;
    const current = accounts[index];
    if (!current) return undefined;

    const renamed: StoredAccount = { ...current, label: normalizeLabel(label) };
    accounts[index] = renamed;
    this.save(accounts);
    return renamed;
  }

  updateLastConnected(id: string, isoTime: string): void {
    const accounts = this.load();
    const index = accounts.findIndex((account) => account.id === id);
    if (index < 0) return;
    const current = accounts[index];
    if (!current) return;
    accounts[index] = { ...current, lastConnectedAt: isoTime };
    this.save(accounts);
  }

  remove(id: string): StoredAccount | undefined {
    const accounts = this.load();
    const removed = accounts.find((account) => account.id === id);
    if (!removed) return undefined;
    this.save(accounts.filter((account) => account.id !== id));
    return removed;
  }

  private recoverCorrupt(raw: string): StoredAccount[] {
    const stamp = this.now().toISOString().replace(/[:.]/g, "-");
    let backup = `${this.filePath}.corrupt-${stamp}`;
    let counter = 1;
    while (fs.existsSync(backup)) {
      backup = `${this.filePath}.corrupt-${stamp}-${counter}`;
      counter += 1;
    }
    try {
      fs.renameSync(this.filePath, backup);
    } catch {
      // If rename is not possible, copy the bytes and only then remove the
      // registry; never lose the corrupt content.
      try {
        fs.writeFileSync(backup, raw);
        fs.rmSync(this.filePath, { force: true });
      } catch {
        throw new AppError(
          "INTERNAL_ERROR",
          "Account store is corrupted and could not be backed up",
        );
      }
    }
    return [];
  }

  private save(accounts: readonly StoredAccount[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(accounts, null, 2));
    fs.renameSync(temporary, this.filePath);
  }
}
