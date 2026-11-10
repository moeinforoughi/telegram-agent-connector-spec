import { describe, expect, it } from "vitest";
import { AppError, isAppError, toSerializedError } from "../../src/shared/errors";

describe("AppError", () => {
  it("preserves a known code, message and retryability", () => {
    const error = new AppError("LOGIN_REQUIRED", "Login is required", { retryable: true });

    expect(error.code).toBe("LOGIN_REQUIRED");
    expect(error.message).toBe("Login is required");
    expect(error.retryable).toBe(true);
    expect(isAppError(error)).toBe(true);
  });

  it("serializes known errors for IPC", () => {
    expect(toSerializedError(new AppError("ACCOUNT_NOT_FOUND", "Account not found"))).toEqual({
      code: "ACCOUNT_NOT_FOUND",
      message: "Account not found",
      retryable: false,
    });
  });

  it("does not leak unknown error text", () => {
    expect(toSerializedError(new Error("cookie=secret"))).toEqual({
      code: "INTERNAL_ERROR",
      message: "Unexpected error",
      retryable: false,
    });
  });

  it("handles non-error thrown values", () => {
    expect(toSerializedError("boom")).toEqual({
      code: "INTERNAL_ERROR",
      message: "Unexpected error",
      retryable: false,
    });
  });
});
