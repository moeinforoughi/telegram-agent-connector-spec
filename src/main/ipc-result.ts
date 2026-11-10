import { AppError, toSerializedError } from "../shared/errors";
import type { IpcResult } from "../shared/ipc";

export async function runIpcHandler<T>(handler: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await handler() };
  } catch (error) {
    console.error(
      "[ipc] handler failed:",
      error instanceof AppError ? error.code : error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: toSerializedError(error) };
  }
}
