# TASK 00 — Feasibility & Technical Spike

Priority: P0 | Depends on: None | Commit: `docs(spike): record Telegram Web feasibility`

## Objective
قبل از ساخت محصول، امکان‌پذیری روش UI Automation را ثابت کن.

## Work Items
- [x] نسخه‌های سازگار Node LTS، Electron، Playwright و MCP SDK را از مستندات رسمی بررسی کن.
- [x] یک پروژه موقت TypeScript بساز.
- [x] Chromium قابل مشاهده را با Playwright اجرا کن.
- [x] به `https://web.telegram.org/` برو و صفحه ورود را بررسی کن.
- [x] با حساب آزمایشی، QR Login را دستی انجام بده.
- [x] `launchPersistentContext` را با مسیر Profile اختصاصی تست کن.
- [x] Browser و برنامه را ببند و دوباره باز کن.
- [x] بررسی کن نشست باقی مانده است یا خیر.
- [x] تشخیص Login State را با Locatorهای قابل مشاهده آزمایش کن.
- [x] بررسی کن حداقل فهرست چت‌ها از UI قابل خواندن است.
- [x] هیچ API ID/Hash، Bot Token یا endpoint خصوصی استفاده نکن.
- [x] محدودیت‌های UI و احتمال تغییر Selector را ثبت کن.
- [x] شرایط Telegram Content Licensing را در گزارش درج کن.

## Tests
- [x] Browser launch.
- [x] Telegram Web load.
- [x] Manual QR login.
- [x] Persistent profile after process restart.
- [x] Login state detection.
- [x] Browser close/reopen.
- [x] No credentials in logs.

## Result (2026-11-10)

**GO — conditional.** All Phase 0 checks passed on Windows 11 x64 with Playwright 1.65.0 (Chrome for Testing 158.0.8127.18) and the WebZ `/k/` variant. The test account logged in through the visible UI, the session survived a new browser process on the same profile, 15 chat items were readable, and a second profile instance was blocked.

Not tested in Phase 0 (deferred): Phone Login, 2FA, full Windows restart, Electron app restart, session revocation, three-account isolation, profile ACL/backup. Direct Telegram access was blocked on the test network; a local HTTP proxy was used.

Full report: `docs/spike/PHASE0_REPORT.md`. Evidence: `spike/logs/spike-state.jsonl`.

## Acceptance Criteria
- [x] ورود با حساب آزمایشی بدون API credentials انجام شود.
- [x] نشست بعد از Restart حفظ شود، در صورتی که Telegram آن را معتبر نگه داشته باشد.
- [x] Profile مستقل و Lock قابل مشاهده باشد.
- [x] روش به endpoint خصوصی یا API credentials وابسته نباشد.
- [x] گزارش Go/No-Go و Known Limitations نوشته شود.

## Stop Conditions
اگر ورود یا حفظ نشست با روش UI قابل اثبات نیست، توسعه قابلیت‌های بعدی متوقف شود و راهکار جایگزین برای تصمیم کاربر گزارش شود. مشکل را با استخراج Token یا استفاده از API خصوصی دور نزن.
