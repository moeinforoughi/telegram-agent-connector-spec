# Phase 4 — Telegram Operations: Phase Report

Status: **IN PROGRESS** — Tasks 1–4 implemented. See `TASK3_AGENT_INTERFACE.md`
and `TASK4_MESSAGING.md` for automated verification and live limitations.
Last updated: 2026-11-11
Plan: `docs/phase4/PHASE4_PLAN.md`

This file is the phase-level report. Per-task evidence lives in
`TASK1_DOM_AUDIT.md` and `TASK2_READ_ADAPTER.md`.

## 1. Executive summary

Phase 4 adds read-only Telegram operations on top of the multi-account browser
from Phase 3. Two tasks are done and committed:

| Task | Scope | Commit |
|---|---|---|
| 1 | Read-only DOM/selector audit with two real sessions | `363ea0a` |
| 2 | Per-account action queue + read-only chat/message adapter | `b7eae50` |

The Task 2 checkpoint contained no write operations: no send, reply, edit, delete,
forward, or reaction. No real message content, chat title, cookie, token, phone
number, or proxy credential is stored in the repository.

## 2. Queue architecture

`src/main/account-action-queue.ts`

- One `AccountActionQueue` per account, created lazily inside
  `TelegramReadAdapter`; there is no global queue.
- Operations on the same account are strictly sequential (promise tail).
- Different accounts have independent tails and therefore run in parallel.
- A failed or timed-out operation rejects only its own call; the tail is cleared
  so the next operation still runs (no poisoned queue).
- Every operation re-checks `getPage()`; a missing or closed page fails with
  `BROWSER_CLOSED`, and a later reconnect works again.
- Bounded timeout (`TIMEOUT`, default 15 s, configurable per adapter/call).
- No retry loop, so no infinite retry.
- **Limit:** the timeout rejects the caller but cannot cancel an in-flight
  Playwright call.

## 3. Chat and message API

`src/main/telegram-read-adapter.ts`

| Method | Opens a chat? | Notes |
|---|---|---|
| `listChats(accountId, {limit})` | No | Reads visible rows (default 20, cap 20) |
| `searchChats(accountId, query, {limit})` | No | Types in the real search box, reads results, clears it |
| `getChatListState(accountId)` | No | `ready` / `empty` / `loading` / `ui_changed` |
| `getOpenChatInfo(accountId)` | No | Current chat id/title/type/title visibility, or `null` |
| `openChat(accountId, chatId)` | **Yes, explicit only** | May mark messages read |
| `readVisibleMessages(accountId, {limit})` | No | Last visible messages, default 20, cap 50 |
| `getMessageMetadata(accountId, {limit})` | No | Same rows without text |
| `getMessageCount(accountId)` | No | Visible bubble count |
| `classifyMessageDirection(classes)` | n/a | Pure `incoming` / `outgoing` / `unknown` |

Every call is bound to an account id and that account's live page. Callers cannot
supply selectors, and no call reads another account's page.

## 4. Output structures

```ts
type ChatSummary = {
  id: string;                  // data-peer-id
  title: string;               // capped 256 chars
  type: "user" | "group" | "channel" | "unknown";
  lastMessagePreview?: string; // capped 256 chars
  unread: boolean;             // visible unread badge only
};

type OpenChatInfo = { id: string | null; title: string; type: ChatType; titleVisible: boolean };

type MessageSummary = {
  id: string;                  // data-mid
  text?: string;               // only when requested; capped 4000 chars
  direction: "incoming" | "outgoing" | "unknown";
  timestamp?: string;          // ISO from data-timestamp when present
  sender?: string;             // only from a real .peer-title; capped 128
};

type ReadMessagesResult = { messages: MessageSummary[]; totalVisible: number; truncated: boolean };
```

Unknown values are omitted or reported as `unknown`; nothing is guessed.

## 5. Selectors used

Centralized in `src/core/telegram/selectors/selector-map.ts` (all Phase 4 Task 2
additions):

- Chat rows: `#chatlist-container .chatlist-chat[data-peer-id]`
- Row fields: `.dialog-title .peer-title` / `.row-title .peer-title`,
  `.dialog-subtitle` / `.row-subtitle`, `.dialog-subtitle-badge-unread`
- Search: `.input-search-input`, `.search-super`, search result rows
- Open chat: `#column-center .chat.active`, chat title, `data-peer-id` source
- Messages: `.bubbles`, `.bubble[data-mid]`, `.message`, `.peer-title`,
  `data-timestamp`, `.is-in` / `.is-out`
- Loading: scoped chat-list and message-area preloaders
- Detection helpers: `src/core/telegram/chat-surface.ts`

A missing or restructured UI raises `TELEGRAM_UI_CHANGED`; the adapter does not
guess.

## 6. Telegram Web limitations observed

- `data-type` on chat rows is unreliable; list rows return `type: "unknown"`.
- Channel vs group is only reliable after opening (`.channel-post`).
- Hashed CSS-module classes (search-empty marker) must be matched by stable
  prefix and otherwise fail safely.
- Message history can take seconds; the adapter waits on the preloader with a
  bounded timeout and raises `TIMEOUT`.
- Media-only messages may have no text; sender/timestamp only when the DOM
  exposes them.
- Opening a chat can mark it read, so lists/search never open chats.

## 7. Test results (actually executed)

Command: `npm run check` on 2026-11-11, exit code 0.

| Stage | Result |
|---|---|
| Typecheck | PASS |
| Lint | PASS |
| Format check | PASS |
| Unit | 21 files / **134 tests** PASS |
| Integration (real Chromium fixtures) | 4 files / **31 tests** PASS |
| Electron E2E | **13 tests** PASS |
| Build | PASS |

Task 2 test coverage: queue sequencing, cross-account parallelism/isolation,
error recovery, timeout, browser closed, disconnect/recovery; adapter list,
search, empty search, list state, open chat, message list, limits, incoming and
outgoing classification, metadata without text, empty messages, loading timeout,
UI changed, account isolation, missing page.

## 8. Real smoke (sanitized, 2026-11-10)

| Account | Chat list state | Rows | Search results |
|---|---|---|---|
| `moein1` | ready | 11 | 5 |
| `kaonashi` | ready | 12 | 1 |

- Proxy: SOCKS5 `127.0.0.1:12334`.
- No chat was opened: every visible chat had an unread badge, and opening unread
  chats was forbidden by the task rules. Live message reading was therefore
  deliberately skipped; message helpers are covered by synthetic fixtures only.
- Evidence for this run is the sanitized record in
  `docs/phase4/TASK2_READ_ADAPTER.md` and `SESSION_LOG.md`; there is no raw run
  log, because content must not be logged.
- No profile or session was deleted, reset, or logged out.

## 9. Unresolved issues and limits

- No live message read; only fixture coverage.
- Queue deadlines quarantine the affected page until replacement.
- Chat-list peer type is not reliable before opening.
- The diagnostics panel discloses read-marking before message retrieval.
- Browser close reason is still not modelled as crash vs. normal close.

## 10. Commits in this phase

| Commit | Meaning |
|---|---|
| `75734ed` | Phase 4 plan |
| `d7f3485` | Task 1 selector audit docs |
| `363ea0a` | Read-only chat surface detection |
| `b7eae50` | Per-account read-only queue and adapter |

## 11. Next task

The user confirmed live delivery to Saved Messages and requested a handoff.
Live Reply and the final Connector acknowledgement remain unverified. Future
live submissions require explicit approval for the account, destination,
message text and reply target when applicable.
