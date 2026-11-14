import { describe, expect, it, vi } from "vitest";
import { MessageOperations } from "../../src/main/message-operations";
import { AppError } from "../../src/shared/errors";

const candidate = { id: "101", title: "Test peer", type: "user" as const };
const request = { accountId: "account-a", recipientQuery: "test", text: "Synthetic text" };

function setup() {
  let now = 1000;
  const execute = vi.fn(async () => "42");
  const resolve = vi.fn<ConstructorParameters<typeof MessageOperations>[0]["resolve"]>(
    async () => ({ status: "resolved", recipient: candidate, source: "search" }) as const,
  );
  const select = vi.fn(resolve);
  const inspectReply = vi.fn(async () => ({ recipient: candidate, targetPreview: "Original" }));
  const operations = new MessageOperations({
    accountLabel: (id) => {
      if (id !== request.accountId) throw new AppError("ACCOUNT_NOT_FOUND", "Account not found");
      return "Test account";
    },
    resolve,
    select,
    inspectReply,
    execute,
    now: () => now,
  });
  return {
    operations,
    resolve,
    select,
    execute,
    inspectReply,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("message operations", () => {
  it("requires explicit choice when a recipient is ambiguous and rejects an empty search", async () => {
    const { operations, resolve, select } = setup();
    resolve.mockResolvedValueOnce({
      status: "ambiguous",
      candidates: [candidate, { ...candidate, id: "102" }],
    });
    await expect(operations.prepareSend(request)).resolves.toMatchObject({ status: "ambiguous" });
    await expect(operations.prepareSend({ ...request, recipientId: "101" })).resolves.toMatchObject(
      { status: "prepared" },
    );
    expect(select).toHaveBeenCalledWith(request.accountId, request.recipientQuery, "101");
    resolve.mockResolvedValueOnce({ status: "not_found" });
    await expect(operations.prepareSend(request)).rejects.toMatchObject({ code: "CHAT_NOT_FOUND" });
    await expect(
      operations.prepareSend({ ...request, recipientId: "invalid" }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("invalidates an older approval and reports a known pre-submission failure", async () => {
    const { operations, execute } = setup();
    const old = await operations.prepareSend(request);
    const current = await operations.prepareSend({ ...request, text: "Replacement" });
    if (old.status !== "prepared" || current.status !== "prepared")
      throw new Error("Expected preparation");
    await expect(operations.confirm(old, async () => true)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    execute.mockRejectedValueOnce(new AppError("BROWSER_CLOSED", "Browser closed"));
    await expect(operations.confirm(current, async () => true)).resolves.toMatchObject({
      status: "failed",
      error: { code: "BROWSER_CLOSED" },
    });
  });
  it("binds approval to an exact, immutable, one-use operation", async () => {
    const { operations, execute } = setup();
    const prepared = await operations.prepareSend(request);
    if (prepared.status !== "prepared") throw new Error("Expected preparation");
    expect(prepared).toMatchObject({
      confirmationRequired: true,
      recipient: candidate,
      text: request.text,
    });
    expect(execute).not.toHaveBeenCalled();
    await expect(
      operations.confirm({ ...prepared, accountId: "other" }, async () => true),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    const approve = vi.fn(async () => true);
    const first = operations.confirm(prepared, approve);
    await expect(operations.confirm(prepared, approve)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    await expect(first).resolves.toMatchObject({ status: "sent", messageId: "42" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rejects empty, oversized and invalid-account requests", async () => {
    const { operations } = setup();
    for (const text of ["   ", "a".repeat(4097)]) {
      await expect(operations.prepareSend({ ...request, text })).rejects.toMatchObject({
        code: "INVALID_ARGUMENT",
      });
    }
    await expect(operations.prepareSend({ ...request, accountId: "other" })).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
  });

  it("expires during approval and never executes a declined operation", async () => {
    const { operations, execute, advance } = setup();
    const prepared = await operations.prepareSend(request);
    if (prepared.status !== "prepared") throw new Error("Expected preparation");
    await expect(
      operations.confirm(prepared, async () => {
        advance(120_000);
        return true;
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    const next = await operations.prepareSend(request);
    if (next.status !== "prepared") throw new Error("Expected preparation");
    await expect(operations.confirm(next, async () => false)).resolves.toMatchObject({
      status: "cancelled",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("requires a verified reply target and preserves its ID", async () => {
    const { operations, execute, inspectReply } = setup();
    const reply = {
      accountId: request.accountId,
      chatId: "101",
      messageId: "51",
      text: request.text,
    };
    await expect(operations.prepareReply({ ...reply, messageId: "latest" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    const prepared = await operations.prepareReply(reply);
    expect(inspectReply).toHaveBeenCalledWith(request.accountId, "101", "51");
    expect(prepared).toMatchObject({ kind: "reply", messageId: "51", targetPreview: "Original" });
    await operations.confirm(prepared, async () => true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "reply", messageId: "51" }),
      undefined,
    );
  });

  it("returns an unknown outcome and consumes the operation after an uncertain submission", async () => {
    const { operations, execute } = setup();
    execute.mockRejectedValueOnce(new AppError("OUTCOME_UNKNOWN", "Unverified"));
    const prepared = await operations.prepareSend(request);
    if (prepared.status !== "prepared") throw new Error("Expected preparation");
    await expect(operations.confirm(prepared, async () => true)).resolves.toMatchObject({
      status: "unknown_result",
      code: "OUTCOME_UNKNOWN",
    });
    await expect(operations.confirm(prepared, async () => true)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
