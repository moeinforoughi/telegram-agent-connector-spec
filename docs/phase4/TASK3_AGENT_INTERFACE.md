# Phase 4 Task 3 — Agent-ready read-only interface

Task 1 established the WebZ selectors and surface probes. Task 2 established
the per-account queue, list/search, explicit open, and visible message reads.
Task 3 composes those primitives in TelegramService with compact shared DTOs
and an explicit Electron API. The per-account diagnostics panel performs
local reads and defaults to message metadata.

| Capability | Default and limit | Behavior |
|---|---|---|
| getAccounts / getAccountStatus | Account registry | Renderer-safe account views |
| searchChats | 5 maximum | Visible search results with no chat opening |
| resolveRecipient / selectRecipient | 5 maximum | Resolve unique result, return ambiguity, or verify explicit choice |
| getChatList | 20 maximum | Read the visible list without opening chats |
| getChatMessages | 10 default, 30 maximum | Verify active peer and read visible messages. Opening can mark the chat read. |
| getUiHealth | 5 route statuses | Audited shell, list, search, active chat, message list |

The resolver re-runs bounded search before reusing a mapping. It discards
stale IDs and retains explicit choices in memory per account for up to ten
minutes, with up to fifty mappings per account. No contact enumeration occurs.
Unaudited peer types are reported as unknown. A search-only peer may require
opening the chat manually in Telegram before the connector can read it.

Connection checks inspect the known surfaces once per page. Each action
checks its own route when invoked. The message read verifies the expected
peer in the same DOM snapshot as the extracted rows. Composer and message
mutation surfaces require their own selector audit. The per-account queue
quarantines a page after its outer deadline because an in-flight browser
action can continue. Reconnect obtains a replacement page.

| UI route | Navigation | Verification |
|---|---|---|
| Main | Existing account connection | A known shell is visible and the login surface is absent |
| Chat list | Read current sidebar | A known chat-list container exists |
| Search | Fill the audited search input | Visible rows or the audited empty state appear; the input is cleared |
| Open chat | Click one visible list row with the requested peer ID | The active chat header exposes the same peer ID |
| Message list | Read the active chat after loading | Active peer and message list are verified within the extraction snapshot |
| Composer / basic message mutations | Reserved for the later selector audit | No executable route |

IPC uses the trusted renderer main frame, a channel allowlist and validated
inputs. No DOM, selector, credentials or local paths enter Telegram DTOs.
Message text is local and opt-in from diagnostics. IPC failure logging records
the error code or class only. No dependency changes were required.

## Verification — 2026-11-14

`npm run check` passed typecheck, lint, formatting, production build,
164 unit tests, 33 Chromium integration tests, and 14 Electron E2E tests.
The tests used synthetic fixtures and temporary app data. Live Task 3 behavior
on preserved profiles, including the current WebZ search and active peer
markup, remains for Task 4.
