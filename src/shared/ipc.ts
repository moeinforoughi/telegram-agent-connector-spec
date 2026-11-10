import type { AccountView } from "./account";
import type { SerializedError } from "./errors";
import type {
  ProxySettingsView,
  ProxyTestRequest,
  ProxyTestResult,
  SaveProxySettingsRequest,
} from "./proxy";
import type { AppInfo } from "./types";

export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
  getAccount: "account:get",
  startAccount: "account:start",
  stopAccount: "account:stop",
  openTelegram: "account:open",
  removeAccount: "account:remove",
  getProxySettings: "proxy:get",
  saveProxySettings: "proxy:save",
  testProxy: "proxy:test",
} as const;

export const IPC_EVENTS = {
  accountStatus: "account:status",
} as const;

export const IPC_ALLOWLIST = [
  IPC_CHANNELS.getAppInfo,
  IPC_CHANNELS.getAccount,
  IPC_CHANNELS.startAccount,
  IPC_CHANNELS.stopAccount,
  IPC_CHANNELS.openTelegram,
  IPC_CHANNELS.removeAccount,
  IPC_CHANNELS.getProxySettings,
  IPC_CHANNELS.saveProxySettings,
  IPC_CHANNELS.testProxy,
] as const;

export type IpcChannel = (typeof IPC_ALLOWLIST)[number];

export type IpcResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: SerializedError };

export type RemoveAccountRequest = {
  readonly deleteProfile: boolean;
};

export type ConnectorApi = {
  getAppInfo(): Promise<IpcResult<AppInfo>>;
  getAccount(): Promise<IpcResult<AccountView>>;
  startAccount(): Promise<IpcResult<AccountView>>;
  stopAccount(): Promise<IpcResult<AccountView>>;
  openTelegram(): Promise<IpcResult<AccountView>>;
  removeAccount(request: RemoveAccountRequest): Promise<IpcResult<AccountView>>;
  getProxySettings(): Promise<IpcResult<ProxySettingsView>>;
  saveProxySettings(request: SaveProxySettingsRequest): Promise<IpcResult<ProxySettingsView>>;
  testProxy(request: ProxyTestRequest): Promise<IpcResult<ProxyTestResult>>;
  onAccountStatus(listener: (view: AccountView) => void): () => void;
};
