import { useState } from "react";
import type { IpcResult } from "../../shared/ipc";
import {
  MAX_MESSAGE_LENGTH,
  type PrepareMessageResult,
  type PreparedMessage,
} from "../../shared/messaging";
import type { AgentRecipient } from "../../shared/telegram";

export function TelegramMessaging({ accountId }: { readonly accountId: string }) {
  const [kind, setKind] = useState<"send" | "reply">("send");
  const [query, setQuery] = useState("");
  const [chatId, setChatId] = useState("");
  const [messageId, setMessageId] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PreparedMessage | null>(null);
  const [candidates, setCandidates] = useState<readonly AgentRecipient[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run<T>(action: () => Promise<IpcResult<T>>, success: (value: T) => void) {
    setBusy(true);
    setStatus("");
    try {
      const result = await action();
      if (result.ok) success(result.data);
      else setStatus(`${result.error.code}: ${result.error.message}`);
    } catch {
      setStatus(
        "The request could not be completed. Check Telegram before attempting to send again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function showPreparation(result: PrepareMessageResult) {
    if (result.status === "prepared") {
      setPending(result);
      setCandidates([]);
    } else {
      setCandidates(result.candidates);
      setStatus("Select the intended recipient.");
    }
  }

  function prepare(recipientId?: string) {
    setCandidates([]);
    if (kind === "reply") {
      void run(
        () => window.api.prepareReply({ accountId, chatId, messageId, text }),
        showPreparation,
      );
    } else {
      void run(
        () =>
          window.api.prepareSend({
            accountId,
            recipientQuery: query,
            text,
            ...(recipientId === undefined ? {} : { recipientId }),
          }),
        showPreparation,
      );
    }
  }

  function finish(confirm: boolean) {
    if (!pending) return;
    const ref = { accountId, operationId: pending.operationId };
    setPending(null);
    void run(
      () => (confirm ? window.api.confirmMessage(ref) : window.api.cancelMessage(ref)),
      (outcome) => {
        switch (outcome.status) {
          case "sent":
            setStatus(`Sent. Message ID ${outcome.messageId}.`);
            setText("");
            break;
          case "unknown_result":
            setStatus(outcome.message);
            setText("");
            break;
          case "failed":
            setStatus(`${outcome.error.code}: ${outcome.error.message}`);
            break;
          case "cancelled":
            setStatus("Cancelled.");
        }
      },
    );
  }

  return (
    <details>
      <summary>Send or reply</summary>
      <fieldset disabled={busy || pending !== null}>
        <legend>Prepare message</legend>
        <label>
          Operation
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value === "reply" ? "reply" : "send");
              setCandidates([]);
            }}
          >
            <option value="send">Send</option>
            <option value="reply">Reply</option>
          </select>
        </label>
        {kind === "send" ? (
          <label>
            Recipient name or username
            <input
              maxLength={200}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCandidates([]);
              }}
            />
          </label>
        ) : (
          <>
            <p className="hint">Open the target chat in Telegram and use a visible message ID.</p>
            <label>
              Reply chat ID
              <input
                maxLength={21}
                value={chatId}
                onChange={(event) => setChatId(event.target.value)}
              />
            </label>
            <label>
              Reply message ID
              <input
                maxLength={20}
                value={messageId}
                onChange={(event) => setMessageId(event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Message text
          <textarea
            maxLength={MAX_MESSAGE_LENGTH}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setCandidates([]);
            }}
          />
        </label>
        <button
          type="button"
          disabled={
            !text.trim() || (kind === "send" ? !query.trim() : !chatId.trim() || !messageId.trim())
          }
          onClick={() => prepare()}
        >
          Prepare
        </button>
        {candidates.length > 0 && (
          <ul>
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button type="button" onClick={() => prepare(candidate.id)}>
                  {candidate.title} ({candidate.id})
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {pending && (
        <div>
          <p>
            {pending.accountLabel} → {pending.recipient.title} ({pending.recipient.id})
          </p>
          {pending.kind === "reply" && (
            <p>
              Reply to {pending.messageId}: {pending.targetPreview}
            </p>
          )}
          <pre className="telegram-result">{pending.text}</pre>
          <p className="hint">Review and approve the exact message in the confirmation dialog.</p>
          <div className="actions">
            <button type="button" onClick={() => finish(true)}>
              Review and confirm
            </button>
            <button type="button" onClick={() => finish(false)}>
              Cancel preparation
            </button>
          </div>
        </div>
      )}
      {busy && <p role="status">Working…</p>}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
