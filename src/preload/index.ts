import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type ConnectorApi } from "../shared/ipc";

const api: ConnectorApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo),
};

contextBridge.exposeInMainWorld("api", api);
