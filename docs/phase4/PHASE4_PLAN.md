# Phase 4 — Telegram Operations (Plan)

Status: **In progress — Task 1 complete; Task 2 awaiting explicit approval.**
Date: 2026-11-10
Depends on: Phase 3 (COMPLETE FOR MVP)
Scope source: `TASKS/05_TELEGRAM_OPERATIONS.md`, user direction 2026-11-10,
`ROADMAP.md`

## 1. Goal

Add controlled Telegram Web operations to the connector, starting **read-only**,
using the existing two preserved account sessions. No Telegram API credentials,
MTProto, Bot API, private endpoint, or network interception.

Initial user-facing operations:

- Read chat list (bounded).
- Search chats (if the visible UI supports it).
- Read messages in a selected chat (bounded).
- View channel information (read-only).
- Later, only with explicit approval: send, reply, and channel management.

## 2. Non-negotiable guardrails

- UI automation only through visible Telegram Web elements and centralized
  selectors.
- Read-only first. **No real message may be sent, edited, deleted, forwarded, or
  reacted to without explicit user approval for that step.**
- No bulk messaging, mass invite, spam, or rate-limit bypass.
- Message content is not sent to an LLM, external service, log, or IPC beyond
  the bounded result the UI requested.
- No cookie, token, session file, phone number, or identity data is read,
  extracted, logged, or committed.
- The two existing profiles/sessions are preserved. Never delete, reset,
  logout, or remove them during Phase 4 development or tests.
- One account's actions must never affect another account's session or UI.
- On selector/UI uncertainty, stop with `TELEGRAM_UI_CHANGED`; never guess.
- Per-account operations are serialized; a queue is added in this phase.

## 3. Architecture

```
AccountManager
  └─ AccountRuntime (existing)
        ├─ AccountController + BrowserManager
        └─ TelegramOperations (new)
              ├─ selector layer (existing selector-map, extended)
              ├─ action queue (per account)
              └─ bounded DTOs (chat/message summaries)
```

- `TelegramOperations` receives the account's `Page`/probe and exposes small
  methods; it never owns the browser lifecycle.
- A per-account `ActionQueue` serializes read and write operations; read-only
  operations may run sequentially per account.
- Results are bounded: limits on chats/messages, truncated previews only where
  necessary, no raw HTML.
- IPC adds explicit channels; every payload and result is validated. No generic
  `evaluate`, selector, URL, or shell parameter is exposed.
- MCP stays Phase 5; no MCP tool is added here.

## 4. Operations and gating

| Operation | Phase 4 stage | Gate |
|---|---|---|
| Account/connection status | Read-only | None beyond connected account |
| Chat list (limit) | Read-only | None |
| Chat search | Read-only | Only if visible UI supports it |
| Read messages (limit) | Read-only | None; content stays local |
| Channel info view | Read-only | None |
| Archive/Mute/Pin | Low-risk write | Per-action confirmation in UI |
| Send message | Write | **Explicit user approval before implementation and before execution** |
| Reply | Write | Same as send |
| Delete/Edit/Forward | Out of scope | Not in Phase 4 MVP |
| Bulk/Invite/Spam | Forbidden | Never |

## 5. Tasks

### Task 1 — Phase 4 plan, task mapping and selector audit
Write this plan, map `TASKS/05`, confirm the current WebZ DOM for chat list,
search, message list, and composer using read-only inspection. No writes.
**Status: COMPLETE (`363ea0a`) — report `docs/phase4/TASK1_DOM_AUDIT.md`.**

### Task 2 — Per-account action queue and safe read helpers
Add a small serialized queue per account and read-only helpers for chat list and
message list. Bounded results; stop on UI change.

### Task 3 — IPC/preload/renderer read-only operations
Add explicit read channels and a per-account operations panel (chat list,
bounded messages, search). No content is logged or sent to an LLM.

### Task 4 — Live read-only validation with the two preserved sessions
Use `moein1` and `kaonashi`; read a small chat list and a few messages. Do not
send/edit/delete. Record sanitized results (counts and statuses only).

### Task 5 — Low-risk write operations (after approval)
Archive/Mute/Pin with UI confirmation and post-action verification, if the UI
supports them.

### Task 6 — Send/Reply design and gated implementation (separate approval)
Only after explicit approval: design, confirm-before-send in UI, post-send
verification, no retries on ambiguous outcome.

### Task 7 — Channel view/manage
Read-only channel info first; management actions need their own approval.

### Task 8 — Report and Phase 4 closure
Automated + live read-only results, limitations, handoff, report.

## 6. Testing

- Unit: queue serialization, DTO bounds, selector missing, UI changed, wrong
  account guard, timeout, result redaction.
- Integration: local HTML fixtures for chat list/messages/search; no real
  Telegram.
- E2E: operations panel, read-only calls, no sensitive data rendering.
- Live: two preserved sessions, read-only; counts/status only in docs.
- Write operations: not tested against real Telegram without explicit approval;
  use fixtures and confirmation flows first.

## 7. Definition of Done

- Read-only chat list/search/message reading works through the real UI for at
  least one preserved account.
- Results are bounded and contain no secrets; logs are redacted.
- Per-account queue prevents concurrent operations on one account.
- UI changes fail safely with `TELEGRAM_UI_CHANGED`.
- No message is sent/edited/deleted without explicit approval.
- Existing accounts/profiles/sessions remain intact.
- Typecheck, lint, format, unit, integration, E2E and `npm run check` pass.
- Docs and handoff updated; every task committed independently.

## 8. Risks and decisions

- **DOM drift:** selectors are a contract; any mismatch stops the operation.
- **Rate limits/ToS:** read operations use small limits and no polling loop;
  writes are gated and never bulk.
- **Privacy:** message content stays local; docs record only counts/statuses.
- **Wrong-account guard:** every operation is bound to the account id and its
  Page; a closed/changed page stops the operation.
- **TASKS/05 conflict:** TASKS/05 says message content is not read in MVP; this
  user-approved Phase 4 plan extends that to bounded, local, read-only message
  reading. Sending remains gated. This supersession must be reflected in task
  notes before implementation.

## 9. Explicit non-goals

- MCP bridge/tools (Phase 5).
- Deleting/editing/forwarding messages.
- Bulk messaging, mass invite, spam, rate-limit bypass.
- AI/LLM processing of message content.
- Reading cookies/tokens/session files.

## 10. Status (2026-11-10)

| Task | Status |
|---|---|
| 1 — Plan/selector audit | **Done** (`363ea0a`); report `docs/phase4/TASK1_DOM_AUDIT.md` |
| 2 — Action queue + read helpers | Not started; awaiting approval |
| 3 — Read-only IPC/renderer | Not started |
| 4 — Live read-only validation | Not started |
| 5–8 | Not started |
