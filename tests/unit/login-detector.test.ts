import { describe, expect, it, vi } from "vitest";
import { detectLoginState, type PageProbe } from "../../src/core/telegram/login-detector";
import { SELECTORS } from "../../src/core/telegram/selectors/selector-map";

function probe(visible: string[], counts: Record<string, number> = {}): PageProbe {
  return {
    url: () => "https://web.telegram.org/k/",
    isVisible: async (selector) => visible.includes(selector),
    count: async (selector) => counts[selector] ?? 0,
  };
}

const auth = SELECTORS.authPage[0];
const chatList = SELECTORS.chatList[0];
const chatItems = SELECTORS.chatItems[0];

describe("detectLoginState", () => {
  it("requires login when the auth page is visible", async () => {
    const result = await detectLoginState(probe([auth]));

    expect(result.state).toBe("LOGIN_REQUIRED");
    expect(result.evidence).toContain(`visible:${auth}`);
  });

  it("reports connected only when the chat list is visible and auth is not", async () => {
    const result = await detectLoginState(probe([chatList], { [chatItems]: 3 }));

    expect(result.state).toBe("CONNECTED");
    expect(result.evidence).toContain(`visible:${chatList}`);
    expect(result.evidence).toContain(`chatItems:${chatItems}:3`);
  });

  it("treats auth and chat list together as authenticating, not connected", async () => {
    const result = await detectLoginState(probe([auth, chatList]));

    expect(result.state).toBe("AUTHENTICATING");
  });

  it("returns unknown when nothing expected is visible", async () => {
    const result = await detectLoginState(probe([]));

    expect(result.state).toBe("UNKNOWN");
    expect(result.evidence).toEqual([]);
  });

  it("does not count hidden elements as visible", async () => {
    const hiddenProbe: PageProbe = {
      url: () => "https://web.telegram.org/k/",
      isVisible: async () => false,
      count: async () => 10,
    };

    expect((await detectLoginState(hiddenProbe)).state).toBe("UNKNOWN");
  });

  it("reports state changes through the monitor callback", async () => {
    const callback = vi.fn();
    const { waitForConnected } = await import("../../src/core/telegram/login-monitor");
    const states = ["LOGIN_REQUIRED", "AUTHENTICATING", "CONNECTED", "CONNECTED"] as const;
    let index = 0;
    let clock = 0;

    await waitForConnected({
      detect: async () => ({
        state: states[Math.min(index++, states.length - 1)] ?? "UNKNOWN",
        evidence: [],
      }),
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      onState: callback,
    });

    expect(callback.mock.calls.map(([state]) => state)).toEqual([
      "LOGIN_REQUIRED",
      "AUTHENTICATING",
      "CONNECTED",
    ]);
  });
});
