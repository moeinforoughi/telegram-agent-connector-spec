import type { Page } from "playwright";
import { AppError } from "../shared/errors";

export type AccountActionQueueOptions = {
  readonly getPage: () => Page | undefined;
  readonly timeoutMs?: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(
        new AppError("TIMEOUT", "Telegram read operation timed out", {
          retryable: true,
        }),
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * One serial queue per account. A failed operation never poisons the queue:
 * later operations still run.
 *
 * A timed-out operation cannot be cancelled (Playwright offers no abort), so it
 * may still be using the page. The queue therefore refuses further work on that
 * page until the page is replaced (disconnect/reconnect) instead of overlapping
 * two operations on one page.
 */
export class AccountActionQueue {
  private readonly getPage: () => Page | undefined;
  private readonly timeoutMs: number;
  private tail: Promise<void> = Promise.resolve();
  private readonly timedOutPages = new WeakSet<Page>();

  constructor(options: AccountActionQueueOptions) {
    this.getPage = options.getPage;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  run<T>(task: (page: Page) => Promise<T>, timeoutMs = this.timeoutMs): Promise<T> {
    const execute = async (): Promise<T> => {
      const page = this.getPage();
      if (!page || page.isClosed()) {
        throw new AppError("BROWSER_CLOSED", "Browser is not available for this account", {
          retryable: true,
        });
      }
      if (this.timedOutPages.has(page)) {
        throw new AppError(
          "TIMEOUT",
          "A previous operation did not finish; disconnect and reconnect this account",
          { retryable: true },
        );
      }
      return withTimeout(task(page), timeoutMs, () => this.timedOutPages.add(page));
    };

    const result = this.tail.then(execute, execute);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
