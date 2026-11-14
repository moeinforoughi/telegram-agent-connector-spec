/**
 * Compact, transport-independent DTOs for agent-facing Telegram operations.
 * These are deliberately small: the agent never sees DOM, selectors, or
 * unbounded lists. Limits are enforced in the service layer, not by callers.
 */
export type TelegramChatType = "user" | "group" | "channel" | "unknown";

export type TelegramMessageDirection = "incoming" | "outgoing" | "unknown";

export const AGENT_LIMITS = {
  searchResults: 5,
  chatList: 20,
  messagesDefault: 10,
  messagesMax: 30,
} as const;

export type AgentChat = {
  readonly id: string;
  readonly title: string;
  readonly type: TelegramChatType;
  readonly unread: boolean;
  readonly lastMessagePreview?: string;
};

export type AgentMessage = {
  readonly id: string;
  readonly direction: TelegramMessageDirection;
  readonly text?: string;
  readonly timestamp?: string;
  readonly sender?: string;
};

export type AgentChatMessages = {
  readonly chatId: string;
  /** True when the chat was opened by this call, which may mark it read. */
  readonly opened: boolean;
  readonly messages: readonly AgentMessage[];
  readonly truncated: boolean;
};

export type AgentRecipient = {
  readonly id: string;
  readonly title: string;
  readonly type: TelegramChatType;
};

export type AgentRecipientResolution =
  | {
      readonly status: "resolved";
      readonly recipient: AgentRecipient;
      readonly source: "search" | "selection" | "cache";
    }
  | { readonly status: "ambiguous"; readonly candidates: readonly AgentRecipient[] }
  | { readonly status: "not_found" };

export type UiRouteName = "main" | "chatList" | "search" | "openChat" | "messageList";

export type UiRouteStatus = "ok" | "missing" | "not_applicable";

export type UiHealth = {
  readonly status: "ready" | "login_required" | "ui_changed";
  readonly routes: readonly { readonly name: UiRouteName; readonly status: UiRouteStatus }[];
};
