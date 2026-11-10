import type { SerializedError } from "./errors";
import type { AppInfo } from "./types";

export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
} as const;

export const IPC_ALLOWLIST = [IPC_CHANNELS.getAppInfo] as const;

export type IpcChannel = (typeof IPC_ALLOWLIST)[number];

export type IpcResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: SerializedError };

export type ConnectorApi = {
  getAppInfo(): Promise<IpcResult<AppInfo>>;
};
