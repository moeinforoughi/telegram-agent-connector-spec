import type { ConnectorApi } from "../../shared/ipc";

declare global {
  interface Window {
    api: ConnectorApi;
  }
}

export {};
