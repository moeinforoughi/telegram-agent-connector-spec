# Security Threat Model

## دارایی‌های حساس
1. Browser Profile و Session Telegram.
2. اطلاعات Account و Chat Metadata.
3. Local IPC endpoint.
4. تنظیمات Permission.
5. Log و Crash Report.
6. دسترسی Agent به عملیات Telegram.

## تهدیدها و کنترل‌ها

### T-01 — سرقت Session
- Profile در Local AppData.
- ACL فقط کاربر فعلی.
- عدم Sync ابری.
- عدم Log محتوا یا Cookie.
- راهنمای استفاده از BitLocker.
- امکان Logout و حذف کامل Profile.

### T-02 — دسترسی Process دیگر به Core
- Named Pipe محلی.
- ACL محدود به کاربر فعلی.
- نام Pipe نسخه‌دار و غیرقابل حدس.
- Handshake/Authorization در صورت نیاز.
- Allowlist Methodها.
- سقف اندازه پیام و Timeout.

### T-03 — Prompt Injection در پیام تلگرام
- متن پیام، داده غیرقابل‌اعتماد است.
- پیام هرگز System/Developer Instruction نمی‌شود.
- هیچ دستور اجرایی از محتوای پیام استخراج و مستقیماً اجرا نشود.
- Toolهای MCP سطح‌بالا و Allowlist باشند.

### T-04 — اجرای عملیات روی اکانت اشتباه
- `account_id` اجباری در Toolهای تغییردهنده.
- نمایش Account Label در UI.
- Queue و Lock مستقل.
- Audit Log با Account ID.
- عدم استفاده از اکانت پیش‌فرض پنهان.

### T-05 — ارسال تکراری
- وضعیت قبل و بعد از عملیات بررسی شود.
- در نتیجه نامعلوم Retry خودکار نشود.
- `OUTCOME_UNKNOWN` برگردد.
- عملیات ارسال انبوه پشتیبانی نشود.

### T-06 — افشای Secret در Log
- Redaction مرکزی.
- ممنوعیت Log کردن Page Content، Cookie، Storage State، QR Payload، کد ورود و رمز.
- تست خودکار Secret Leakage.

### T-07 — Browser/Selector Manipulation
- فقط دامنه Telegram Web مجاز.
- ناوبری غیرمنتظره متوقف شود.
- Selectorها متمرکز و قابل تست باشند.
- در UI_CHANGED عملیات متوقف شود.
- هیچ `page.evaluate` دلخواه از MCP ارائه نشود.

### T-08 — Malicious MCP Client
- Tool Schema محدود.
- ورودی‌ها با Zod Validate شوند.
- Path از Agent دریافت نشود.
- دسترسی فایل عمومی وجود نداشته باشد.
- Rate Limit محلی برای عملیات.

## High-risk Actions
حذف پیام/چت، ترک گروه/کانال، Block/Unblock، تغییر رمز یا نشست‌ها و ارسال انبوه در MVP غیرفعال یا نیازمند تأیید صریح UI هستند.

## Security Testing
- بررسی عدم وجود Secret در Log.
- بررسی عدم دسترسی Renderer به Node.
- تست Pipe ACL و اتصال غیرمجاز.
- تست Path Traversal.
- تست Profile Lock.
- تست MCP stdout contamination.
- تست اینکه پیام تلگرام نمی‌تواند Permission را تغییر دهد.
