import { describe, expect, it } from "vitest";
import type { TelegramDomProbe } from "../../src/core/telegram/chat-surface";
import { SELECTORS } from "../../src/core/telegram/selectors/selector-map";
import { checkUiHealth, UI_ROUTES } from "../../src/core/telegram/ui-map";

function probe(visible: readonly string[]): TelegramDomProbe {
  return {
    url: () => "https://web.telegram.org/k/",
    isVisible: async (selector) => visible.includes(selector),
    count: async () => 0,
    attribute: async () => null,
  };
}

describe("checkUiHealth", () => {
  it("reports ready when the required routes are visible", async () => {
    const health = await checkUiHealth(
      probe([SELECTORS.mainShell[0]!, SELECTORS.chatListContainer[0]!]),
    );

    expect(health.status).toBe("ready");
    expect(health.routes).toEqual([
      { name: "main", status: "ok" },
      { name: "chatList", status: "ok" },
      { name: "search", status: "not_applicable" },
      { name: "openChat", status: "not_applicable" },
      { name: "messageList", status: "not_applicable" },
    ]);
  });

  it("marks contextual routes when they are on screen", async () => {
    const health = await checkUiHealth(
      probe([
        SELECTORS.mainShell[0]!,
        SELECTORS.chatListContainer[0]!,
        SELECTORS.searchInput[0]!,
        SELECTORS.openChat[0]!,
        SELECTORS.messageList[0]!,
      ]),
    );

    expect(health.status).toBe("ready");
    expect(health.routes.filter((route) => route.status === "ok")).toHaveLength(5);
  });

  it("fails closed when a required route is missing", async () => {
    const health = await checkUiHealth(probe([SELECTORS.mainShell[0]!]));

    expect(health.status).toBe("ui_changed");
    expect(health.routes.find((route) => route.name === "chatList")?.status).toBe("missing");
  });

  it("reports login_required when the auth page is visible", async () => {
    const health = await checkUiHealth(probe([SELECTORS.authPage[0]!]));

    expect(health.status).toBe("login_required");
    expect(health.routes.every((route) => route.status === "missing")).toBe(true);
  });

  it("fails closed on an unknown structure", async () => {
    const health = await checkUiHealth(probe([]));

    expect(health.status).toBe("ui_changed");
    expect(health.routes.some((route) => route.status === "ok")).toBe(false);
  });

  it("only maps audited routes", () => {
    expect(UI_ROUTES.map((route) => route.name)).toEqual([
      "main",
      "chatList",
      "search",
      "openChat",
      "messageList",
    ]);
    for (const route of UI_ROUTES) {
      expect(route.selectors.length).toBeGreaterThan(0);
      expect(route.failureCondition.length).toBeGreaterThan(0);
    }
  });
});
