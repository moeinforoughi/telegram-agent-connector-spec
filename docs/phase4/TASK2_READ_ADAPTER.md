# Phase 4 — Task 2: Queue + Read-Only Chat/Message Helpers

Status: **COMPLETE**
Date: 2026-11-10
Commit: `b7eae50`
Scope: per-account action queue and read-only chat/message helpers. No write
operation exists. No message was sent, edited, deleted, forwarded, or reacted to.

## 1. Account action queue

`src/main/account-action-queue.ts`:

- One `AccountActionQueue` per account (created lazily by the adapter), never a
  global queue.
- Operations on one account run strictly sequentially via a promise tail.
- Different accounts have independent tails and run in parallel.
- A failure or timeout never poisons the queue; the next operation runs.
- Before every operation the queue checks `getPage()`; missing or closed page
  fails with `BROWSER_CLOSED`.
- Each operation has a bounded timeout (`TIMEOUT`, default 15 s, configurable).
- No retry loop; timed-out operations reject and the queue continues.
- The timeout cannot cancel an in-flight Playwright call; the next operation may
  start while the old one is still settling. This is documented as a limitation.

## 2. Read-only adapter

`src/main/telegram-read-adapter.ts`:

| Method | Behavior |
|---|---|
| `listChats(accountId, {limit})` | Reads chat rows; never opens a chat |
| `searchChats(accountId, query, {limit})` | Types in the search box, reads result rows, clears it; never opens a chat |
| `getChatListState(accountId)` | ready/empty/loading/ui_changed |
| `getOpenChatInfo(accountId)` | Current chat id/title/type/title visibility, or `null` |
| `openChat(accountId, chatId)` | **Explicit** open only; returns chat info |
| `readVisibleMessages(accountId, {limit})` | Last visible messages with text, bounded |
| `getMessageMetadata(accountId, {limit})` | Same rows without text |
| `getMessageCount(accountId)` | Visible message count |
| `classifyMessageDirection(classes)` | Pure incoming/outgoing/unknown classifier |

Every method takes an account id and uses that account's live page as the source.
There is no cross-account sharing, no global page, and no selector supplied by a
caller.

## 3. Output structures

```ts
type ChatSummary = {
  id: string;                 // data-peer-id
  title: string;              // bounded to 256 chars
  type: "user" | "group" | "channel" | "unknown";
  lastMessagePreview?: string; // bounded to 256 chars
  unread: boolean;            // visible unread badge only
};

type OpenChatInfo = {
  id: string | null;
  title: string;
  type: ChatType;
  titleVisible: boolean;
};

type MessageSummary = {
  id: string;                 // data-mid
  text?: string;              // only when requested; bounded to 4000 chars
  direction: "incoming" | "outgoing" | "unknown";
  timestamp?: string;         // ISO from data-timestamp when present
  sender?: string;            // only when a peer-title exists; bounded
};

type ReadMessagesResult = {
  messages: MessageSummary[];
  totalVisible: number;
  truncated: boolean;
};
```

Limits: default 20 chats and 20 messages; configured maxima 20 chats / 50
messages per call. Text/title/preview/sender are bounded. No raw HTML.

## 4. Read side effects

- `listChats`, `searchChats`, `getChatListState`, and `getOpenChatInfo` do not
  open chats.
- `openChat` is the only method that opens one, and only on explicit request; it
  may mark the chat as read.
- The adapter never opens another chat while reading messages.
- Live smoke did **not** open chats because every visible chat in the preserved
  accounts currently has an unread badge. Message helpers are covered by
  synthetic fixtures; a live message read remains deliberately avoided.

## 5. Tests

`npm run check` on `b7eae50` — **PASS**:

| Stage | Result |
|---|---|
| Typecheck / Lint / Format | PASS |
| Unit | 21 files / 134 tests |
| Integration | 4 files / 31 tests (real Chromium fixtures) |
| Electron E2E | 13 tests |
| Build | PASS |

Queue coverage: sequential execution, independent account queues, parallel
accounts, error recovery, timeout, browser closed, disconnect/recovery.
Adapter coverage: list, search, empty search, loading/empty list, open chat,
message list, limit, incoming/outgoing, metadata without text, empty messages,
history loading timeout, UI changed, account isolation, missing page.

## 6. Real smoke (2026-11-10, sanitized)

| Account | Chat list state | Rows | Search results |
|---|---|---|---|
| `moein1` | ready | 11 | 5 |
| `kaonashi` | ready | 12 | 1 |

- Both accounts used SOCKS5 `127.0.0.1:12334`.
- No chat was opened; no message was read live; no content was logged.
- Reason: all visible chats had unread badges, and the task rules forbid opening
  unread chats in the real test.
- No profile/session was deleted or reset.

## 7. Limitations

- `listChats` reports `type: "unknown"` because the chat list does not expose a
  reliable peer type. `openChat`/`getOpenChatInfo` can detect the open type via
  `data-type` plus `.channel-post`.
- `unread` is true only when the unread badge is visible; a hidden badge is not
  treated as unread.
- `lastMessagePreview` is the visible subtitle; it may contain a sender prefix
  for groups.
- Message text comes from `.message`; media-only messages may have no text.
- Sender is returned only when a `.peer-title` exists in the bubble.
- Timestamps require `data-timestamp`; missing values are omitted, never guessed.
- `openChat` may mark messages read; callers must open only intentionally.
- Queue timeout cannot cancel an in-flight Playwright operation.
- No IPC/preload/renderer surface exists yet; Task 3 will expose read-only
  operations to the UI.

## 8. Files

- `src/main/account-action-queue.ts`
- `src/main/telegram-read-adapter.ts`
- `src/core/telegram/chat-surface.ts` (loading state refinement)
- `src/core/telegram/selectors/selector-map.ts` (row/text/search selectors)
- `src/main/account-controller.ts`, `account-manager.ts` (`getPage`, Main-only)
- `src/shared/errors.ts` (`CHAT_NOT_FOUND`)
- `tests/unit/account-action-queue.test.ts`, `tests/unit/chat-surface.test.ts`
- `tests/integration/telegram-read-adapter.test.ts`
- `tests/fixtures/telegram/surface-*.html`

## 9. Next

Task 2 is complete. Stop and wait for approval before Task 3 (read-only IPC,
preload and renderer). Do not send/edit/delete/forward/react to messages. Do not
start Phase 5.
