# Prompt — Code Review و Release Readiness

پروژه را برای Release بررسی کن؛ فعلاً تغییرات گسترده ایجاد نکن.

بررسی‌ها:
1. معماری با ADRها منطبق است؟
2. آیا API credentials یا endpoint خصوصی Telegram استفاده شده؟
3. آیا Secret، Cookie، Session یا متن پیام در Log وجود دارد؟
4. آیا Profileها مستقل و دارای Lock هستند؟
5. آیا Renderer به Node دسترسی مستقیم دارد؟
6. آیا MCP stdout فقط پروتکل است؟
7. آیا Toolهای عمومی اجرای کد یا Browser وجود دارند؟
8. آیا AI Content Processing بدون Compliance Gate فعال است؟
9. آیا عملیات حساس Confirmation دارند؟
10. آیا تست‌های Windows clean install اجرا شده‌اند؟
11. آیا Upgrade/Uninstall داده کاربر را ناخواسته حذف می‌کند؟
12. آیا تمام Dependencyها Pin شده‌اند؟
13. آیا README و Known Limitations به‌روز هستند؟
14. آیا تمام تغییرات Commit شده‌اند؟

گزارش را با Severity (Critical/High/Medium/Low) ارائه کن. تا زمانی که Critical یا High باقی مانده، Release را تأیید نکن.
