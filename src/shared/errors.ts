export const ERROR_CODES = [
  "CONNECTOR_NOT_RUNNING",
  "ACCOUNT_NOT_FOUND",
  "CHAT_NOT_FOUND",
  "MESSAGE_NOT_FOUND",
  "ACCOUNT_NOT_CONNECTED",
  "LOGIN_REQUIRED",
  "SESSION_EXPIRED",
  "NETWORK_ERROR",
  "PROXY_ERROR",
  "BROWSER_CLOSED",
  "PROFILE_LOCKED",
  "BROWSER_LAUNCH_FAILED",
  "BROWSER_LIMIT_REACHED",
  "TELEGRAM_UI_CHANGED",
  "UNSUPPORTED_OPERATION",
  "PERMISSION_DENIED",
  "COMPLIANCE_GATE_BLOCKED",
  "RATE_LIMIT_OR_FLOOD_WAIT",
  "OUTCOME_UNKNOWN",
  "TIMEOUT",
  "INVALID_ARGUMENT",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type SerializedError = {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function toSerializedError(error: unknown): SerializedError {
  if (isAppError(error)) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return { code: "INTERNAL_ERROR", message: "Unexpected error", retryable: false };
}
