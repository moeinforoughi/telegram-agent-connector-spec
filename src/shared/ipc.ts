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
  listAccounts: "account:list",
  createAccount: "account:create",
  renameAccount: "account:rename",
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
  IPC_CHANNELS.listAccounts,
  IPC_CHANNELS.createAccount,
  IPC_CHANNELS.renameAccount,
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

export type AccountIdRequest = {
  readonly id: string;
};

export type CreateAccountRequest = {
  readonly label?: string;
};

export type RenameAccountRequest = {
  readonly id: string;
  readonly label: string;
};

export type RemoveAccountRequest = {
  readonly id: string;
  readonly deleteProfile: boolean;
};

export type ConnectorApi = {
  getAppInfo(): Promise<IpcResult<AppInfo>>;
  listAccounts(): Promise<IpcResult<AccountView[]>>;
  createAccount(request: CreateAccountRequest): Promise<IpcResult<AccountView>>;
  renameAccount(request: RenameAccountRequest): Promise<IpcResult<AccountView>>;
  startAccount(request: AccountIdRequest): Promise<IpcResult<AccountView>>;
  stopAccount(request: AccountIdRequest): Promise<IpcResult<AccountView>>;
  openTelegram(request: AccountIdRequest): Promise<IpcResult<AccountView>>;
  removeAccount(request: RemoveAccountRequest): Promise<IpcResult<{ removed: true }>>;
  getProxySettings(): Promise<IpcResult<ProxySettingsView>>;
  saveProxySettings(request: SaveProxySettingsRequest): Promise<IpcResult<ProxySettingsView>>;
  testProxy(request: ProxyTestRequest): Promise<IpcResult<ProxyTestResult>>;
  onAccountStatus(listener: (view: AccountView) => void): () => void;
};
