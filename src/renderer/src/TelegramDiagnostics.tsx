import { useState } from "react";
import type { IpcResult } from "../../shared/ipc";
import type { AgentRecipientResolution } from "../../shared/telegram";

export function TelegramDiagnostics({ id }: { readonly id: string }) {
  const [query, setQuery] = useState("");
  const [chatId, setChatId] = useState("");
  const [includeText, setIncludeText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<unknown>(null);
  const [resolution, setResolution] = useState<AgentRecipientResolution | null>(null);

  async function run<T>(
    action: () => Promise<IpcResult<T>>,
    onSuccess?: (data: T) => void,
  ): Promise<void> {
    setBusy(true);
    setOutput(null);
    setResolution(null);
    try {
      const result = await action();
      if (result.ok) {
        setOutput(result.data);
        onSuccess?.(result.data);
      } else {
        setOutput(result.error);
      }
    } catch {
      setOutput({ message: "Telegram diagnostics could not be reached." });
    } finally {
      setBusy(false);
    }
  }

  function showResolution(value: AgentRecipientResolution): void {
    setResolution(value);
    if (value.status === "resolved") setChatId(value.recipient.id);
  }

  const api = window.api;
  return (
    <details>
      <summary>Telegram diagnostics</summary>
      <fieldset disabled={busy} aria-busy={busy}>
        <legend>Read operations</legend>
        <div className="actions">
          <button type="button" onClick={() => void run(() => api.getAccountStatus({ id }))}>
            Account status
          </button>
          <button type="button" onClick={() => void run(() => api.getUiHealth({ id }))}>
            Check UI
          </button>
          <button type="button" onClick={() => void run(() => api.getChatList({ id }))}>
            List chats
          </button>
        </div>
        <label>
          Name or username
          <input
            value={query}
            maxLength={200}
            onChange={(event) => {
              setQuery(event.target.value);
              setResolution(null);
            }}
          />
        </label>
        <div className="actions">
          <button
            type="button"
            disabled={!query.trim()}
            onClick={() => void run(() => api.searchChats({ id, query }))}
          >
            Search chats
          </button>
          <button
            type="button"
            disabled={!query.trim()}
            onClick={() => void run(() => api.resolveRecipient({ id, query }), showResolution)}
          >
            Resolve recipient
          </button>
        </div>
        {resolution?.status === "ambiguous" && (
          <ul>
            {resolution.candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      () => api.selectRecipient({ id, query, recipientId: candidate.id }),
                      showResolution,
                    )
                  }
                >
                  {candidate.title} ({candidate.type}, {candidate.id})
                </button>
              </li>
            ))}
          </ul>
        )}
        <label>
          Chat ID
          <input
            value={chatId}
            maxLength={128}
            onChange={(event) => setChatId(event.target.value)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeText}
            onChange={(event) => setIncludeText(event.target.checked)}
          />
          Include message text
        </label>
        <p className="hint">Reading messages may open the chat and mark it as read.</p>
        <button
          type="button"
          disabled={!chatId.trim()}
          onClick={() => void run(() => api.getChatMessages({ id, chatId, includeText }))}
        >
          Read recent messages
        </button>
      </fieldset>
      {busy && <p role="status">Reading Telegram…</p>}
      {output !== null && (
        <pre className="telegram-result" aria-live="polite">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </details>
  );
}
