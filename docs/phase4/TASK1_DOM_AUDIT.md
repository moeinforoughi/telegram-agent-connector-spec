# Phase 4 — Task 1: Read-Only Telegram DOM / Selector Audit

Status: **COMPLETE**
Date: 2026-11-10
Commit: `363ea0a`
Scope: read-only DOM/selector audit, adapter detection, fixtures and tests.
No message was sent, edited, deleted, forwarded, or reacted to.

## 1. Method (read-only)

- Used the existing Playwright Chromium and the two preserved sessions
  (`moein1`, `kaonashi`) with proxy SOCKS5 `127.0.0.1:12334`.
- Launched each profile sequentially with `launchPersistentContext` in headless
  mode; no concurrent contexts for one profile.
- Inspected element structure, classes, roles and attribute **names** only.
- No chat title, message text, phone number, identity data, cookie, token, or
  profile path was logged, saved, or committed.
- One chat was opened once to audit the message surface; this may mark that chat
  as read. No other account action was taken. All later checks were read-only.

## 2. Real smoke results (sanitized)

| Account | Main surface | Chat list |
|---|---|---|
| `moein1` | ready | ready, 11 rows |
| `kaonashi` | ready | ready, 12 rows |

One opened chat:

- Open-chat detection: `open=true`
- Type: `user`
- Title visible: `true`
- Message stats: total 30, incoming 30, outgoing 0, channel posts 0
- No text or identifiers were recorded.

Both profiles were separate contexts; neither login required a new QR.

## 3. Confirmed selectors

All selectors are centralized in
`src/core/telegram/selectors/selector-map.ts`.

| Surface | Selector(s) | Notes |
|---|---|---|
| Main shell | `#page-chats`, `#column-left` | `#column-left` is also the chat-list container |
| Login page | `#auth-pages` | visible auth UI means login required |
| Chat list container | `#chatlist-container` | inside `#column-left` |
| Chat list rows | `#chatlist-container .chatlist-chat[data-peer-id]` | excludes the archive pseudo-row |
| Chat title (list) | `.peer-title`, `.user-title` | within a row |
| Search input | `.input-search-input` | `#search-input` does not exist in current WebZ |
| Search results | `.search-super` | active search panel |
| Search empty | `.search-super [class*="NoResults"]` | hashed CSS module |
| Open chat | `#column-center .chats-container .chat.active` | `data-type` is `chat`/`channel`/`group` when present |
| Chat header | `#column-center .topbar`, `.chat-info`, `.peer-title` | `topbar` is the stable header container |
| Message list | `#column-center .bubbles`, `.bubbles .scrollable` | `role="region"` on the scrollable |
| Message rows | `#column-center .bubble[data-mid]` | `role="article"`, `data-mid`/`data-timestamp` |
| Incoming / outgoing | `.bubble.is-in[data-mid]` / `.bubble.is-out[data-mid]` | direction classes |
| Channel posts | `.bubble.channel-post` | reliable channel signal |
| Loading | `.preloader-container.is-visible` | message area; search also uses `.spinner`/`.loading` |
| Chat list empty | no rows + container visible | search-empty uses `NoResults` |

## 4. Adapter and tests

New module: `src/core/telegram/chat-surface.ts`.

Functions (all read-only, no text access):

- `detectMainSurface` — ready/login/loading/ui_changed
- `detectChatList` — ready (row count), empty, loading, ui_changed
- `detectOpenChat` — open, type, title visibility
- `readMessageStats` — total/incoming/outgoing/channel posts
- `detectSearchState` — idle/active/loading/no_results/unknown
- `detectChannel` — open-chat type or channel-post evidence
- `createTelegramDomProbe` — Playwright adapter with `attribute` support

Tests:

| Test | Kind | Result |
|---|---|---|
| Chat list detection | Unit + fixture + real smoke | PASS |
| Chat search state | Unit + fixture (empty) | PASS |
| Chat opening | Unit + fixture + real smoke | PASS |
| Message list detection | Unit + fixture + real smoke | PASS |
| Incoming/outgoing classification | Unit + fixture + real smoke | PASS |
| Channel detection | Unit + fixture | PASS |
| Loading state | Unit + fixture | PASS |
| Empty state | Unit + fixture | PASS |
| Telegram UI changed | Unit + fixture | PASS |
| Account isolation | Fixture pages + two real sessions | PASS |

`npm run check` on `363ea0a`: **PASS** — 129 unit, 20 integration, 13 E2E,
build, typecheck, lint, format.

## 5. Limitations and safeguards

- `NoResults` is a hashed CSS-module class; the adapter matches the stable
  `NoResults` prefix via `[class*="NoResults"]`. A future rename must fail safely
  as `TELEGRAM_UI_CHANGED`, not guess.
- `data-type="chat"` can appear on channel-like chats; `.channel-post` is used as
  a fallback channel signal.
- Chat-list-level channel/group classification is not reliable before opening a
  chat; channel detection is only guaranteed after opening (`data-type` or
  channel posts).
- Search input `aria-label` is `Updating...` before search is active; do not use
  it as a readiness signal. Use `.input-search-input` visibility.
- Message history may take several seconds; use the visible preloader as the
  loading signal and a bounded timeout.
- Opening a chat can mark messages read. Task 2 must avoid unnecessary opens and
  keep all operations serialized per account.
- No write operation exists in Task 1. Send/Reply/Delete/Edit/Forward remain out
  of scope until explicit approval.

## 6. Files

- `src/core/telegram/selectors/selector-map.ts` — extended selector layer.
- `src/core/telegram/chat-surface.ts` — read-only adapter.
- `tests/unit/chat-surface.test.ts` — detection logic.
- `tests/integration/telegram-surface.test.ts` — real Chromium fixtures.
- `tests/fixtures/telegram/surface-*.html` — synthetic, non-user data.

## 7. Next

Task 1 is complete. Stop here and wait for approval before Task 2
(per-account action queue and read-only chat/message helpers). No message may be
sent, edited, deleted, forwarded, or reacted to.
