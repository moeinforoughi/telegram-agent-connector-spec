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
