import type { SerializedError } from "./errors";

export const ACCOUNT_STATUSES = [
  "disconnected",
  "ready",
  "initializing",
  "waiting_for_login",
  "authenticating",
  "connected",
  "error",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type LoginState = "LOGIN_REQUIRED" | "AUTHENTICATING" | "CONNECTED" | "UNKNOWN";

/** Renderer-safe account view. Never contains profile paths or credentials. */
export type AccountView = {
  readonly id: string | null;
  readonly label: string;
  readonly status: AccountStatus;
  readonly loginState?: LoginState;
  readonly error?: SerializedError;
  readonly createdAt?: string;
  readonly lastConnectedAt?: string;
};
