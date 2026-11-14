import { describe, expect, it, vi } from "vitest";
import {
  RecipientResolver,
  type RecipientCandidate,
  type RecipientSearch,
} from "../../src/main/recipient-resolver";

const alice: RecipientCandidate = { id: "1001", title: "Alice", type: "user" };
const alice2: RecipientCandidate = { id: "1002", title: "Alice Work", type: "user" };

function setup(
  results: RecipientCandidate[] | ((query: string) => RecipientCandidate[]),
  options: { ttlMs?: number; start?: number } = {},
) {
  let clock = options.start ?? 1_000;
  let current = typeof results === "function" ? results : () => results;
  const search = vi.fn<RecipientSearch>(async (_accountId, query) => current(query));
  const resolver = new RecipientResolver({
    search,
    now: () => clock,
    ...(options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs }),
  });
  return {
    resolver,
    search,
    advance: (ms: number) => {
      clock += ms;
    },
    setResults: (next: RecipientCandidate[] | ((query: string) => RecipientCandidate[])) => {
      current = typeof next === "function" ? next : () => next;
    },
  };
}

describe("RecipientResolver", () => {
  it("requires self-chat evidence for the exact Saved Messages query", async () => {
    const { resolver, setResults } = setup([alice]);
    await expect(resolver.resolve("a1", "Saved Messages")).resolves.toEqual({
      status: "not_found",
    });
    const self = { id: "1003", title: "Saved Messages", type: "self", isSelfChat: true } as const;
    setResults([alice, self]);
    await expect(resolver.resolve("a1", "Saved Messages")).resolves.toMatchObject({
      recipient: self,
    });
    await expect(resolver.select("a1", "Saved Messages", alice.id)).rejects.toMatchObject({
      code: "CHAT_NOT_FOUND",
    });
  });
  it("returns not_found for an empty search", async () => {
    const { resolver } = setup([]);
    await expect(resolver.resolve("a1", "nobody")).resolves.toEqual({ status: "not_found" });
  });

  it("resolves a single result", async () => {
    const { resolver } = setup([alice]);
    await expect(resolver.resolve("a1", "Alice")).resolves.toEqual({
      status: "resolved",
      recipient: alice,
      source: "search",
    });
  });

  it("returns bounded candidates and never picks one when ambiguous", async () => {
    const { resolver, search } = setup([alice, alice2, { ...alice, id: "1003" }]);

    await expect(resolver.resolve("a1", "alice")).resolves.toEqual({
      status: "ambiguous",
      candidates: [alice, alice2, { ...alice, id: "1003" }],
    });
    expect(search).toHaveBeenCalledWith("a1", "alice", 5);
  });

  it("asks the search for at most five results", async () => {
    const { resolver, search } = setup([alice]);
    await resolver.resolve("a1", "alice");
    expect(search.mock.calls[0]?.[2]).toBe(5);
  });

  it("keeps the cache per account", async () => {
    const { resolver, search } = setup([alice]);

    await resolver.resolve("a1", "alice");
    await expect(resolver.resolve("a2", "alice")).resolves.toMatchObject({ source: "search" });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("serves a repeated query from the cache", async () => {
    const { resolver, search } = setup([alice]);

    await resolver.resolve("a1", "  ALICE  ");
    await expect(resolver.resolve("a1", "alice")).resolves.toMatchObject({ source: "cache" });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("re-searches after the cache expires", async () => {
    const { resolver, search, advance } = setup([alice], { ttlMs: 1_000 });

    await resolver.resolve("a1", "alice");
    advance(1_001);
    await expect(resolver.resolve("a1", "alice")).resolves.toMatchObject({ source: "search" });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a stale mapping when the account no longer resolves it", async () => {
    const { resolver, advance, setResults } = setup([alice], { ttlMs: 1_000 });

    await expect(resolver.resolve("a1", "alice")).resolves.toMatchObject({
      recipient: alice,
    });

    advance(100);
    setResults([alice2]);
    await expect(resolver.resolve("a1", "alice")).resolves.toEqual({
      status: "resolved",
      recipient: alice2,
      source: "search",
    });
  });

  it("does not let a previous automatic match hide new ambiguity", async () => {
    const { resolver, setResults } = setup([alice]);
    await resolver.resolve("a1", "alice");
    setResults([alice, alice2]);
    await expect(resolver.resolve("a1", "alice")).resolves.toEqual({
      status: "ambiguous",
      candidates: [alice, alice2],
    });
  });

  it("accepts an explicit selection that is a current search result", async () => {
    const { resolver } = setup([alice, alice2]);

    await expect(resolver.select("a1", "alice", "1002")).resolves.toEqual({
      status: "resolved",
      recipient: alice2,
      source: "selection",
    });
  });

  it("ignores previous selection for operations requiring a fresh explicit choice", async () => {
    const { resolver } = setup([alice, alice2]);
    await resolver.select("a1", "alice", "1002");
    await expect(resolver.resolve("a1", "alice", { usePreviousSelection: false })).resolves.toEqual(
      {
        status: "ambiguous",
        candidates: [alice, alice2],
      },
    );
  });

  it("rejects an invalid recipient id", async () => {
    const { resolver } = setup([alice]);

    await expect(resolver.select("a1", "alice", "9999")).rejects.toMatchObject({
      code: "CHAT_NOT_FOUND",
    });
    await expect(resolver.select("a1", "alice", "  ")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("rejects an empty query", async () => {
    const { resolver, search } = setup([alice]);

    await expect(resolver.resolve("a1", "   ")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("drops cached mappings for one account or all accounts", async () => {
    const { resolver } = setup([alice]);

    await resolver.resolve("a1", "alice");
    await resolver.resolve("a2", "alice");
    resolver.invalidate("a1");
    await expect(resolver.resolve("a1", "alice")).resolves.toMatchObject({ source: "search" });
    await expect(resolver.resolve("a2", "alice")).resolves.toMatchObject({ source: "cache" });

    resolver.invalidate();
    await expect(resolver.resolve("a2", "alice")).resolves.toMatchObject({ source: "search" });
  });
});
