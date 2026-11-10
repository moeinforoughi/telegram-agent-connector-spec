import { contextBridge, ipcRenderer } from "electron";
import type { AccountView } from "../shared/account";
import { IPC_CHANNELS, IPC_EVENTS, type ConnectorApi } from "../shared/ipc";

const api: ConnectorApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo),
  getAccount: () => ipcRenderer.invoke(IPC_CHANNELS.getAccount),
  startAccount: () => ipcRenderer.invoke(IPC_CHANNELS.startAccount),
  stopAccount: () => ipcRenderer.invoke(IPC_CHANNELS.stopAccount),
  openTelegram: () => ipcRenderer.invoke(IPC_CHANNELS.openTelegram),
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
