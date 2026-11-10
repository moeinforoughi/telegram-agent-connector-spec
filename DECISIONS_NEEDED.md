# Decisions Needed

این فایل برای ابهام‌هایی است که قبل از تصمیم‌گیری نباید با حدس حل شوند.

| ID | سؤال | گزینه‌ها | اثر | وضعیت |
|---|---|---|---|---|
| D-001 | کدام Telegram Web variant در PoC پایدارتر است؟ | Variantهای قابل مشاهده و رسمی | Selector و Login | Resolved for MVP (WebZ `/k/`) — pending approval |
| D-002 | Named Pipe ACL با راهکار Node قابل تضمین است؟ | ACL مستقیم / نام تصادفی + Secret | امنیت IPC | Open |
| D-003 | نسخه دقیق Electron/Playwright/MCP SDK چیست؟ | نسخه‌های سازگار رسمی | Build و Runtime | Proposed: Node 26.13.0, Electron 45.2.3, Playwright 1.65.0, MCP SDK 1.32.2 — pending approval |
| D-004 | آیا AI content processing از نظر Telegram terms قابل فعال‌سازی است؟ | Legal/Consent review | قابلیت پاسخ هوشمند | Blocked |
| D-005 | آیا Windows 10 باید در MVP پشتیبانی شود؟ | Windows 11 only / Windows 10+11 | QA و Packaging | Open |
| D-006 | در شبکه‌هایی که Telegram مسدود است، Proxy چگونه تأمین شود؟ | اتکا به VPN/Proxy سیستم / تنظیم Proxy داخل برنامه | اتصال کاربران | Open |

هر تصمیم پذیرفته‌شده باید در `ARCHITECTURE_DECISIONS.md` ثبت شود.

Phase 0 evidence and details: `docs/spike/PHASE0_REPORT.md`.
