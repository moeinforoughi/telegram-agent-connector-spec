# Decisions Needed

این فایل برای ابهام‌هایی است که قبل از تصمیم‌گیری نباید با حدس حل شوند.

| ID | سؤال | گزینه‌ها | اثر | وضعیت |
|---|---|---|---|---|
| D-001 | کدام Telegram Web variant در PoC پایدارتر است؟ | Variantهای قابل مشاهده و رسمی | Selector و Login | Accepted: WebZ `/k/`؛ Selector متمرکز و تشخیص بر اساس Visibility |
| D-002 | Named Pipe ACL با راهکار Node قابل تضمین است؟ | ACL مستقیم / نام تصادفی + Secret | امنیت IPC | Open (Phase 5) |
| D-003 | نسخه دقیق Electron/Playwright/MCP SDK چیست؟ | نسخه‌های سازگار رسمی | Build و Runtime | Accepted: Node 26.13.0, Electron 45.2.3, Playwright 1.65.0 (Chromium 158.0.8127.18), MCP SDK 1.32.2, TypeScript 5.9.3, Zod 4.6.7 — Peer compatibility تأیید شد (Phase 1) |
| D-004 | آیا AI content processing از نظر Telegram terms قابل فعال‌سازی است؟ | Legal/Consent review | قابلیت پاسخ هوشمند | Blocked |
| D-005 | آیا Windows 10 باید در MVP پشتیبانی شود؟ | Windows 11 only / Windows 10+11 | QA و Packaging | Open |
| D-006 | در شبکه‌هایی که Telegram مسدود است، Proxy چگونه تأمین شود؟ | System Proxy First + Manual Fallback | اتصال کاربران | Accepted؛ پیاده‌سازی در Phase 2 |

هر تصمیم پذیرفته‌شده باید در `ARCHITECTURE_DECISIONS.md` ثبت شود.

Phase 0 evidence and details: `docs/spike/PHASE0_REPORT.md`.
