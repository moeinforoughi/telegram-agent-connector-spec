import type { AccountView } from "./account";
import type { SerializedError } from "./errors";
import type {
  ProxySettingsView,
  ProxyTestRequest,
  ProxyTestResult,
  SaveProxySettingsRequest,
} from "./proxy";
import type { AppInfo } from "./types";
import type { AgentChat, AgentChatMessages, AgentRecipientResolution, UiHealth } from "./telegram";

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
  getAccountStatus: "telegram:account-status",
  getChatList: "telegram:chat-list",
  searchChats: "telegram:search",
  resolveRecipient: "telegram:resolve-recipient",
  selectRecipient: "telegram:select-recipient",
  getChatMessages: "telegram:chat-messages",
  getUiHealth: "telegram:ui-health",
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
  IPC_CHANNELS.getAccountStatus,
  IPC_CHANNELS.getChatList,
  IPC_CHANNELS.searchChats,
  IPC_CHANNELS.resolveRecipient,
  IPC_CHANNELS.selectRecipient,
  IPC_CHANNELS.getChatMessages,
  IPC_CHANNELS.getUiHealth,
] as const;

export type IpcChannel = (typeof IPC_ALLOWLIST)[number];

export type IpcResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: SerializedError };

export type AccountIdRequest = {
  readonly id: string;
};

type ChatListRequest = AccountIdRequest & { readonly limit?: number };
type RecipientRequest = AccountIdRequest & { readonly query: string };

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
  getAccountStatus(request: AccountIdRequest): Promise<IpcResult<AccountView>>;
  getChatList(request: ChatListRequest): Promise<IpcResult<readonly AgentChat[]>>;
  searchChats(
    request: RecipientRequest & ChatListRequest,
  ): Promise<IpcResult<readonly AgentChat[]>>;
  resolveRecipient(request: RecipientRequest): Promise<IpcResult<AgentRecipientResolution>>;
  selectRecipient(
    request: RecipientRequest & { recipientId: string },
  ): Promise<IpcResult<AgentRecipientResolution>>;
  getChatMessages(
    request: ChatListRequest & { chatId: string; includeText?: boolean },
  ): Promise<IpcResult<AgentChatMessages>>;
  getUiHealth(request: AccountIdRequest): Promise<IpcResult<UiHealth>>;
  onAccountStatus(listener: (view: AccountView) => void): () => void;
};
