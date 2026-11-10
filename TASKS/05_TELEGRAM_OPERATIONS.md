# TASK 05 — Safe Telegram Web Operations

Priority: P1 | Depends on: TASK 03, TASK 04 | Commit: `feat(telegram): add safe chat operations`

## Objective
پیاده‌سازی عملیات کم‌ریسک و قابل اثبات از طریق UI.

## Initial Operations
- [ ] Account status.
- [ ] Chat list با limit.
- [ ] Search chats در صورت پشتیبانی UI.
- [ ] Archive/Unarchive.
- [ ] Mute/Unmute.
- [ ] Pin/Unpin.

## Work Rules
- Selectorها در `telegram/selectors`.
- از Role، Accessible Name، Label و متن قابل مشاهده استفاده کن.
- CSS class داخلی فقط آخرین گزینه و متمرکز.
- قبل و بعد از عملیات وضعیت را بررسی کن.
- در UI_CHANGED متوقف شو.
- محتوای پیام را در MVP نخوان.
- از Network interception یا endpoint خصوصی استفاده نکن.

## Tests
- [ ] Fixture page برای هر عملیات.
- [ ] Missing selector.
- [ ] Unexpected dialog.
- [ ] Wrong account guard.
- [ ] Operation timeout.
- [ ] UI changed -> safe failure.
- [ ] Result summary bounded.

## Acceptance
عملیات فقط وقتی موفق اعلام شوند که UI نتیجه را تأیید کرده باشد.

## Phase 4 Mapping (2026-11-10)
- Plan: `docs/phase4/PHASE4_PLAN.md`.
- User-approved Phase 4 extends the MVP scope to **bounded, local, read-only**
  chat/message reading with the two preserved sessions.
- Send/Reply/Delete/Edit/Forward are **not** implemented unless the user gives
  explicit approval for that step; read-only work comes first.
- MCP remains Phase 5; no LLM processing of message content.
- The two existing profiles/sessions must never be deleted or reset during
  Phase 4.

## Phase 4 Task 1 Status (2026-11-10)
- [x] Read-only DOM/selector audit with both real sessions.
- [x] Confirmed selectors for main shell, chat list, search, open chat, header,
  messages/direction, channel posts, loading and empty state.
- [x] Read-only `chat-surface` adapter + fixtures + unit/integration tests.
- Report: `docs/phase4/TASK1_DOM_AUDIT.md`; commit `363ea0a`.
- Operations (chat list/search/message read UI/IPC) are **not implemented yet**;
  they belong to Phase 4 Tasks 2–4.
