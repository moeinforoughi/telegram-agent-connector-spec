import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/shared/errors";
import { runIpcHandler } from "../../src/main/ipc-result";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runIpcHandler", () => {
  it("wraps successful synchronous and asynchronous results", async () => {
    await expect(runIpcHandler(() => 42)).resolves.toEqual({ ok: true, data: 42 });
    await expect(runIpcHandler(async () => "value")).resolves.toEqual({ ok: true, data: "value" });
  });

  it("serializes a known error and logs only its code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await runIpcHandler(() => {
      throw new AppError("LOGIN_REQUIRED", "Login required", { retryable: true });
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "LOGIN_REQUIRED", message: "Login required", retryable: true },
    });
    expect(log).toHaveBeenCalledWith("[ipc] handler failed:", "LOGIN_REQUIRED");
  });

  it("hides unknown error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await runIpcHandler(() => {
      throw new Error("cookie=secret");
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Unexpected error", retryable: false },
    });
    expect(log).toHaveBeenCalledWith("[ipc] handler failed:", "Error");
    expect(JSON.stringify(result)).not.toContain("cookie");
  });
});
