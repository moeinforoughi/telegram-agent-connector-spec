import type {
  AgentRecipient as RecipientCandidate,
  AgentRecipientResolution as RecipientResolution,
} from "../shared/telegram";
import { AppError } from "../shared/errors";

export type { RecipientCandidate, RecipientResolution };

export type RecipientSearch = (
  accountId: string,
  query: string,
  limit: number,
) => Promise<RecipientCandidate[]>;

export type RecipientResolverOptions = {
  readonly search: RecipientSearch;
  readonly now?: () => number;
  readonly ttlMs?: number;
  readonly maxResults?: number;
  readonly maxCacheEntries?: number;
};

const DEFAULT_TTL_MS = 10 * 60_000;
const MAX_RESULTS = 5;
const MAX_CACHE_ENTRIES = 50;

type CacheEntry = {
  readonly recipient: RecipientCandidate;
  readonly resolvedAt: number;
  readonly selected: boolean;
};

function normalize(query: string): string {
  const text = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) throw new AppError("INVALID_ARGUMENT", "Recipient query is required");
  if (text.length > 200) throw new AppError("INVALID_ARGUMENT", "Recipient query is too long");
  return text;
}

/**
 * Resolves a name/username to one chat using the existing chat search. It never
 * enumerates contacts, never picks a candidate when the result is ambiguous, and
 * keeps only a small account-scoped cache with a TTL: a stale mapping is re-searched
 * instead of being trusted, and no id is treated as a permanent address.
 */
export class RecipientResolver {
  private readonly search: RecipientSearch;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxResults: number;
  private readonly maxCacheEntries: number;
  private readonly cache = new Map<string, Map<string, CacheEntry>>();

  constructor(options: RecipientResolverOptions) {
    this.search = options.search;
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxResults = options.maxResults ?? MAX_RESULTS;
    this.maxCacheEntries = options.maxCacheEntries ?? MAX_CACHE_ENTRIES;
  }

  async resolve(accountId: string, query: string): Promise<RecipientResolution> {
    const key = normalize(query);
    const cached = this.readCache(accountId, key);
    const candidates = await this.searchCandidates(accountId, key);
    const verified = candidates.find((candidate) => candidate.id === cached?.recipient.id);
    if (verified && (cached?.selected || candidates.length === 1)) {
      return { status: "resolved", recipient: verified, source: "cache" };
    }
    this.cache.get(accountId)?.delete(key);
    if (candidates.length === 0) return { status: "not_found" };
    const only = candidates.length === 1 ? candidates[0] : undefined;
    if (!only) return { status: "ambiguous", candidates };
    this.writeCache(accountId, key, only, false);
    return { status: "resolved", recipient: only, source: "search" };
  }

  /** Explicit user/agent choice; the id must still be a current search result. */
  async select(
    accountId: string,
    query: string,
    recipientId: string,
  ): Promise<RecipientResolution> {
    const key = normalize(query);
    const id = recipientId.trim();
    if (!id) throw new AppError("INVALID_ARGUMENT", "Recipient id is required");

    const candidates = await this.searchCandidates(accountId, key);
    const recipient = candidates.find((candidate) => candidate.id === id);
    if (!recipient) {
      throw new AppError("CHAT_NOT_FOUND", "Selected recipient is not in the search results");
    }
    this.writeCache(accountId, key, recipient, true);
    return { status: "resolved", recipient, source: "selection" };
  }

  /** Drops cached mappings; called when an account's page/profile changes. */
  invalidate(accountId?: string): void {
    if (accountId === undefined) this.cache.clear();
    else this.cache.delete(accountId);
  }

  private async searchCandidates(accountId: string, key: string): Promise<RecipientCandidate[]> {
    const results = await this.search(accountId, key, this.maxResults);
    const seen = new Set<string>();
    return results
      .filter((candidate) => {
        if (candidate.id === "" || seen.has(candidate.id)) return false;
        seen.add(candidate.id);
        return true;
      })
      .slice(0, this.maxResults);
  }

  private readCache(accountId: string, key: string): CacheEntry | undefined {
    const entry = this.cache.get(accountId)?.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.resolvedAt > this.ttlMs) {
      this.cache.get(accountId)?.delete(key);
      return undefined;
    }
    return entry;
  }

  private writeCache(
    accountId: string,
    key: string,
    recipient: RecipientCandidate,
    selected: boolean,
  ): void {
    let entries = this.cache.get(accountId);
    if (!entries) {
      entries = new Map();
      this.cache.set(accountId, entries);
    }
    entries.delete(key);
    entries.set(key, { recipient, resolvedAt: this.now(), selected });
    while (entries.size > this.maxCacheEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  }
}
