# TASK 04 — Multi-account Manager

Priority: P1 | Depends on: TASK 03 | Commit: `feat(accounts): add multi-account manager and dashboard`

## Objective
مدیریت چند اکانت با Profileهای مستقل.

## Work Items
- [x] Account Registry در JSON.
- [x] Create/Update/Remove account.
- [x] UUID ثابت.
- [x] Label قابل ویرایش.
- [x] Profile path از Account ID ساخته شود؛ نه ورودی آزاد کاربر.
- [x] Lazy browser launch.
- [x] یک Browser Context برای هر Profile.
- [x] Per-account serialization (lifecycle؛ Queue عمومی عملیات در Phase 4).
- [x] Max active browser limit (پیش‌فرض ۳).
- [x] حذف Profile فقط با تأیید و گزینه واضح.
- [x] State recovery (Lock کهنه + Registry خراب با Backup).

## Tests
- [x] ساخت سه اکانت.
- [x] استقلال Profileها.
- [x] Lock هر Profile.
- [x] Logout یک اکانت بدون اثر روی بقیه (وضعیت‌ها در Unit؛ لاگین واقعی اکانت دوم Pending).
- [x] Remove account.
- [x] Corrupt registry recovery.
- [x] Path traversal prevention.
- [x] Concurrent same-account calls serialize.

## Acceptance
حداقل سه اکانت مستقل مدیریت شوند؛ هیچ Cookie/Storage مشترک نباشد.

## Status (2026-11-10)
- پیاده‌سازی و تست خودکار: **PASS** (`d1107bc`): 118 Unit، 13 Integration، 13 E2E.
- Registry چنداکانتی، AccountManager با Runtime مستقل برای هر اکانت، سقف ۳
  Browser، Lazy Launch، IPC/Preload/داشبورد چنداکانتی.
- تست زنده: دو Account واقعی (`moein1`, `kaonashi`) با Proxy
  `socks5://127.0.0.1:12334` Connected شدند؛ هر دو Browser بسته شدند و
  Sessionها حفظ شدند. Account سوم به‌صورت زنده تست نشد (پذیرفته‌شده برای MVP).
- بستن عادی Browser اکنون `Ready` است، نه Error (`7ed25a2`).
- Phase 3: **COMPLETE FOR MVP**. جزئیات: `docs/phase3/PHASE3_REPORT.md`.
