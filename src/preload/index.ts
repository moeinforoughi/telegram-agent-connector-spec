import { contextBridge, ipcRenderer } from "electron";
import type { AccountView } from "../shared/account";
import { IPC_CHANNELS, IPC_EVENTS, type ConnectorApi } from "../shared/ipc";

const api: ConnectorApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo),
  listAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.listAccounts),
  createAccount: (request) => ipcRenderer.invoke(IPC_CHANNELS.createAccount, request),
  renameAccount: (request) => ipcRenderer.invoke(IPC_CHANNELS.renameAccount, request),
  startAccount: (request) => ipcRenderer.invoke(IPC_CHANNELS.startAccount, request),
  stopAccount: (request) => ipcRenderer.invoke(IPC_CHANNELS.stopAccount, request),
  openTelegram: (request) => ipcRenderer.invoke(IPC_CHANNELS.openTelegram, request),
  removeAccount: (request) => ipcRenderer.invoke(IPC_CHANNELS.removeAccount, request),
  getProxySettings: () => ipcRenderer.invoke(IPC_CHANNELS.getProxySettings),
  saveProxySettings: (request) => ipcRenderer.invoke(IPC_CHANNELS.saveProxySettings, request),
  testProxy: (request) => ipcRenderer.invoke(IPC_CHANNELS.testProxy, request),
  onAccountStatus: (listener) => {
    const handler = (_event: unknown, view: AccountView): void => listener(view);
    ipcRenderer.on(IPC_EVENTS.accountStatus, handler);
    return () => {
      ipcRenderer.removeListener(IPC_EVENTS.accountStatus, handler);
    };
  },
};

contextBridge.exposeInMainWorld("api", api);
