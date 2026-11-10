import { describe, expect, it } from "vitest";
import {
  detectChannel,
  detectChatList,
  detectMainSurface,
  detectOpenChat,
  detectSearchState,
  readMessageStats,
  type TelegramDomProbe,
} from "../../src/core/telegram/chat-surface";
import { SELECTORS } from "../../src/core/telegram/selectors/selector-map";

type ProbeConfig = {
  visible?: string[];
  counts?: Record<string, number>;
  attributes?: Record<string, string | null>;
};

function probe(config: ProbeConfig = {}): TelegramDomProbe {
  const visible = new Set(config.visible ?? []);
  return {
    url: () => "https://web.telegram.org/k/",
    isVisible: async (selector) => visible.has(selector),
    count: async (selector) => config.counts?.[selector] ?? 0,
    attribute: async (selector, name) => config.attributes?.[`${selector}|${name}`] ?? null,
  };
}

const SHELL = SELECTORS.mainShell[0] ?? "";
const AUTH = SELECTORS.authPage[0] ?? "";
const LOADING = SELECTORS.loading[0] ?? "";
const CHAT_LIST_LOADING = SELECTORS.chatListLoading[0] ?? "";
const CHAT_ROW = SELECTORS.chatRows[0] ?? "";
const OPEN_CHAT = SELECTORS.openChat[0] ?? "";
const TITLE = SELECTORS.chatTitle[0] ?? "";
const SEARCH = SELECTORS.searchInput[0] ?? "";
const NO_RESULTS = SELECTORS.searchNoResults[0] ?? "";
const RESULTS = SELECTORS.searchResults[0] ?? "";

describe("detectMainSurface", () => {
  it("returns ready for the chat shell", async () => {
    expect(await detectMainSurface(probe({ visible: [SHELL] }))).toBe("ready");
  });

  it("returns login_required when auth is visible", async () => {
    expect(await detectMainSurface(probe({ visible: [AUTH] }))).toBe("login_required");
  });

  it("returns loading and ui_changed safely", async () => {
    expect(await detectMainSurface(probe({ visible: [LOADING] }))).toBe("loading");
    expect(await detectMainSurface(probe())).toBe("ui_changed");
  });
});

describe("detectChatList", () => {
  it("counts visible chat rows", async () => {
    expect(await detectChatList(probe({ visible: [SHELL], counts: { [CHAT_ROW]: 2 } }))).toEqual({
      state: "ready",
      itemCount: 2,
    });
  });

  it("reports empty, loading and changed states", async () => {
    expect(await detectChatList(probe({ visible: [SHELL] }))).toEqual({ state: "empty" });
    expect(await detectChatList(probe({ visible: [SHELL, CHAT_LIST_LOADING] }))).toEqual({
      state: "loading",
    });
    expect(await detectChatList(probe({ visible: [AUTH] }))).toEqual({ state: "ui_changed" });
    expect(await detectChatList(probe())).toEqual({ state: "ui_changed" });
  });
});

describe("detectOpenChat", () => {
  it("detects a user chat with a visible title", async () => {
    expect(
      await detectOpenChat(
        probe({
          visible: [OPEN_CHAT, TITLE],
          attributes: { [`${OPEN_CHAT}|data-type`]: "chat" },
        }),
      ),
    ).toEqual({ open: true, type: "user", titleVisible: true });
  });

  it("detects a channel from data-type or channel posts", async () => {
    expect(
      await detectOpenChat(
        probe({
          visible: [OPEN_CHAT],
          attributes: { [`${OPEN_CHAT}|data-type`]: "channel" },
        }),
      ),
    ).toMatchObject({ open: true, type: "channel" });

    expect(
      await detectOpenChat(
        probe({
          visible: [OPEN_CHAT],
          counts: { [SELECTORS.channelPosts[0] ?? ""]: 1 },
        }),
      ),
    ).toMatchObject({ open: true, type: "channel" });
  });

  it("returns closed when no chat is open", async () => {
    expect(await detectOpenChat(probe())).toEqual({ open: false });
  });
});

describe("readMessageStats", () => {
  it("counts direction without reading text", async () => {
    const stats = await readMessageStats(
      probe({
        counts: {
          [SELECTORS.messageRows[0] ?? ""]: 5,
          [SELECTORS.incomingMessages[0] ?? ""]: 3,
          [SELECTORS.outgoingMessages[0] ?? ""]: 2,
          [SELECTORS.channelPosts[0] ?? ""]: 1,
        },
      }),
    );
    expect(stats).toEqual({ total: 5, incoming: 3, outgoing: 2, channelPosts: 1 });
  });
});

describe("detectSearchState", () => {
  it("distinguishes idle, active, no-results and loading", async () => {
    expect(await detectSearchState(probe({ visible: [SEARCH] }))).toBe("idle");
    expect(await detectSearchState(probe({ visible: [SEARCH, RESULTS] }))).toBe("active");
    expect(await detectSearchState(probe({ visible: [SEARCH, RESULTS, NO_RESULTS] }))).toBe(
      "no_results",
    );
    expect(await detectSearchState(probe({ visible: [SEARCH, LOADING] }))).toBe("loading");
    expect(await detectSearchState(probe())).toBe("unknown");
  });
});

describe("detectChannel", () => {
  it("uses the open chat type", async () => {
    expect(
      await detectChannel(
        probe({
          visible: [OPEN_CHAT],
          attributes: { [`${OPEN_CHAT}|data-type`]: "channel" },
        }),
      ),
    ).toBe(true);
    expect(
      await detectChannel(
        probe({
          visible: [OPEN_CHAT],
          attributes: { [`${OPEN_CHAT}|data-type`]: "chat" },
        }),
      ),
    ).toBe(false);
  });
});
