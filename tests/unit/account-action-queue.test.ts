import type { Page } from "playwright";
import { describe, expect, it } from "vitest";
import { AccountActionQueue } from "../../src/main/account-action-queue";

function page(): Page {
  return { isClosed: () => false } as unknown as Page;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("AccountActionQueue", () => {
  it("runs operations sequentially in one account", async () => {
    const events: string[] = [];
    const queue = new AccountActionQueue({ getPage: () => page() });

    const first = queue.run(async () => {
      events.push("first-start");
      await delay(20);
      events.push("first-end");
      return 1;
    });
    const second = queue.run(async () => {
      events.push("second");
      return 2;
    });

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(events).toEqual(["first-start", "first-end", "second"]);
  });

  it("keeps two account queues independent", async () => {
    const events: string[] = [];
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const firstQueue = new AccountActionQueue({ getPage: () => page() });
    const secondQueue = new AccountActionQueue({ getPage: () => page() });

    const first = firstQueue.run(async () => {
      events.push("first-start");
      await gate;
      events.push("first-end");
    });
    const second = secondQueue.run(async () => {
      events.push("second-start");
      await gate;
      events.push("second-end");
    });

    await delay(10);
    expect(events).toEqual(["first-start", "second-start"]);
    release?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "second-start", "first-end", "second-end"]);
  });

  it("continues after a failed operation", async () => {
    const queue = new AccountActionQueue({ getPage: () => page() });

    const failed = queue.run(async () => {
      throw new Error("boom");
    });
    const next = queue.run(async () => "ok");

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });

  it("times out and keeps the queue usable", async () => {
    const queue = new AccountActionQueue({ getPage: () => page(), timeoutMs: 25 });

    const timedOut = queue.run(() => new Promise<string>(() => undefined));
    const next = queue.run(async () => "ok");

    await expect(timedOut).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(next).resolves.toBe("ok");
  });

  it("rejects when the browser is closed and recovers after it returns", async () => {
    let current: Page | undefined;
    const queue = new AccountActionQueue({ getPage: () => current });

    await expect(queue.run(async () => "x")).rejects.toMatchObject({ code: "BROWSER_CLOSED" });

    current = page();
    await expect(queue.run(async () => "ok")).resolves.toBe("ok");

    current = { isClosed: () => true } as unknown as Page;
    await expect(queue.run(async () => "x")).rejects.toMatchObject({ code: "BROWSER_CLOSED" });
  });
});
