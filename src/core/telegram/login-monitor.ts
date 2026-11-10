import { AppError } from "../../shared/errors";
import type { LoginDetection, LoginState } from "./telegram-types";

export type LoginMonitorOptions = {
  readonly detect: () => Promise<LoginDetection>;
  readonly isPageClosed?: () => boolean;
  readonly onState?: (state: LoginState) => void;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly pollMs?: number;
  readonly timeoutMs?: number;
  readonly unknownGraceMs?: number;
  readonly stableChecks?: number;
};

const DEFAULTS = {
  pollMs: 2_000,
  timeoutMs: 15 * 60_000,
  unknownGraceMs: 20_000,
  stableChecks: 2,
} as const;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Polls until the login is confirmed twice in a row. A browser the user closed
 * reports BROWSER_CLOSED; an unrecognized DOM after the grace period reports
 * TELEGRAM_UI_CHANGED; a login that never completes reports TIMEOUT.
 */
export async function waitForConnected(options: LoginMonitorOptions): Promise<LoginDetection> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const pollMs = options.pollMs ?? DEFAULTS.pollMs;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const unknownGraceMs = options.unknownGraceMs ?? DEFAULTS.unknownGraceMs;
  const stableChecks = options.stableChecks ?? DEFAULTS.stableChecks;

  const startedAt = now();
  let unknownSince: number | undefined;
  let lastState: LoginState | undefined;
  let connectedStreak = 0;

  for (;;) {
    if (options.isPageClosed?.()) {
      throw new AppError("BROWSER_CLOSED", "The browser window was closed", { retryable: true });
    }

    const detection = await options.detect();
    if (detection.state !== lastState) {
      lastState = detection.state;
      options.onState?.(detection.state);
    }

    const current = now();
    if (detection.state === "CONNECTED") {
      connectedStreak += 1;
      if (connectedStreak >= stableChecks) return detection;
    } else {
      connectedStreak = 0;
    }

    if (detection.state === "UNKNOWN") {
      unknownSince ??= current;
      if (current - unknownSince >= unknownGraceMs) {
        throw new AppError("TELEGRAM_UI_CHANGED", "Telegram Web UI was not recognized", {
          retryable: true,
        });
      }
    } else {
      unknownSince = undefined;
    }

    if (current - startedAt >= timeoutMs) {
      throw new AppError("TIMEOUT", "Timed out waiting for Telegram login", { retryable: true });
    }

    await sleep(pollMs);
  }
}
