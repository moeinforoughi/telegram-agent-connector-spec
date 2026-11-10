import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors";
import { ensureAccountProfileDir } from "../browser/profile-paths";

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

/**
 * Non-secret account metadata in a local JSON file. Session data stays in the
 * Chromium profile; cookies and tokens are never copied here.
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
      throw new AppError("INTERNAL_ERROR", "Account store is corrupted");
    }
    if (!Array.isArray(parsed) || !parsed.every(isStoredAccount)) {
      throw new AppError("INTERNAL_ERROR", "Account store is corrupted");
    }
    return parsed;
  }

  getFirst(): StoredAccount | undefined {
    return this.load()[0];
  }

  create(label?: string): StoredAccount {
    const accounts = this.load();
    const id = this.nextId();
    const account: StoredAccount = {
      id,
      label: label?.trim() || `Account ${accounts.length + 1}`,
      profileDir: ensureAccountProfileDir(this.profilesRoot, id),
      createdAt: this.now().toISOString(),
    };
    this.save([...accounts, account]);
    return account;
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

  private save(accounts: readonly StoredAccount[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(accounts, null, 2));
    fs.renameSync(temporary, this.filePath);
  }
}
