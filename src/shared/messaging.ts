import type { SerializedError } from "./errors";
import type { AgentRecipient } from "./telegram";

export const MAX_MESSAGE_LENGTH = 4096;

export type SendMessageRequest = {
  readonly accountId: string;
  readonly recipientQuery: string;
  readonly recipientId?: string;
  readonly text: string;
};

export type ReplyMessageRequest = {
  readonly accountId: string;
  readonly chatId: string;
  readonly messageId: string;
  readonly text: string;
};

export type MessageOperationRef = {
  readonly accountId: string;
  readonly operationId: string;
};

export type PreparedMessage = MessageOperationRef & {
  readonly status: "prepared";
  readonly confirmationRequired: true;
  readonly accountLabel: string;
  readonly recipient: AgentRecipient;
  readonly text: string;
  readonly expiresAt: number;
} & (
    | { readonly kind: "send" }
    | { readonly kind: "reply"; readonly messageId: string; readonly targetPreview: string }
  );

export type PrepareMessageResult =
  | PreparedMessage
  | {
      readonly status: "ambiguous";
      readonly candidates: readonly AgentRecipient[];
    };

export type MessageOutcome =
  | {
      readonly status: "sent";
      readonly accountId: string;
      readonly chatId: string;
      readonly messageId: string;
    }
  | { readonly status: "failed"; readonly operationId: string; readonly error: SerializedError }
  | {
      readonly status: "unknown_result";
      readonly operationId: string;
      readonly code: "OUTCOME_UNKNOWN";
      readonly message: string;
    }
  | { readonly status: "cancelled"; readonly operationId: string };
