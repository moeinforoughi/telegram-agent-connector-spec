import { describe, expect, it, vi } from "vitest";
import { waitForConnected } from "../../src/core/telegram/login-monitor";
import type { LoginDetection, LoginState } from "../../src/core/telegram/telegram-types";

function detection(state: LoginState): LoginDetection {
  return { state, evidence: [] };
}

function clocked() {
  let clock = 0;
  return {
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
  };
}

describe("waitForConnected", () => {
  it("waits for two consecutive connected detections", async () => {
    const { now, sleep } = clocked();
    const states = ["LOGIN_REQUIRED", "CONNECTED", "CONNECTED"] as const;
    let index = 0;

    const result = await waitForConnected({
      detect: async () => detection(states[Math.min(index++, states.length - 1)] ?? "UNKNOWN"),
      now,
      sleep,
    });

    expect(result.state).toBe("CONNECTED");
    expect(index).toBe(3);
  });

  it("resets the stability streak on an intermediate non-connected state", async () => {
    const { now, sleep } = clocked();
    const states = ["CONNECTED", "AUTHENTICATING", "CONNECTED", "CONNECTED"] as const;
    let index = 0;

    await waitForConnected({
      detect: async () => detection(states[Math.min(index++, states.length - 1)] ?? "UNKNOWN"),
      now,
      sleep,
    });

    expect(index).toBe(4);
  });

  it("throws TIMEOUT when login never completes", async () => {
    const { now, sleep } = clocked();

    await expect(
      waitForConnected({
        detect: async () => detection("LOGIN_REQUIRED"),
        now,
        sleep,
        timeoutMs: 10_000,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("throws BROWSER_CLOSED when the page disappears", async () => {
    let calls = 0;
    const { now, sleep } = clocked();

    await expect(
      waitForConnected({
        detect: async () => {
          calls += 1;
          return detection("LOGIN_REQUIRED");
        },
        isPageClosed: () => calls > 0,
        now,
        sleep,
      }),
    ).rejects.toMatchObject({ code: "BROWSER_CLOSED" });
  });

  it("throws TELEGRAM_UI_CHANGED after the unknown grace period", async () => {
    const { now, sleep } = clocked();

    await expect(
      waitForConnected({
        detect: async () => detection("UNKNOWN"),
        now,
        sleep,
        unknownGraceMs: 5_000,
        timeoutMs: 60_000,
      }),
    ).rejects.toMatchObject({ code: "TELEGRAM_UI_CHANGED" });
  });

  it("allows unknown states inside the grace period before connecting", async () => {
    const { now, sleep } = clocked();
    const states = ["UNKNOWN", "UNKNOWN", "CONNECTED", "CONNECTED"] as const;
    let index = 0;

    const result = await waitForConnected({
      detect: async () => detection(states[Math.min(index++, states.length - 1)] ?? "UNKNOWN"),
      now,
      sleep,
      unknownGraceMs: 5_000,
    });

    expect(result.state).toBe("CONNECTED");
  });

  it("calls the state listener only when the state changes", async () => {
    const { now, sleep } = clocked();
    const listener = vi.fn();
    const states = ["LOGIN_REQUIRED", "LOGIN_REQUIRED", "CONNECTED", "CONNECTED"] as const;
    let index = 0;

    await waitForConnected({
      detect: async () => detection(states[Math.min(index++, states.length - 1)] ?? "UNKNOWN"),
      now,
      sleep,
      onState: listener,
    });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
