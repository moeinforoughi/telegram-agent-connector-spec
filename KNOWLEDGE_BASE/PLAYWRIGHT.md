# Playwright Notes

## Persistent Context

برای حفظ Cookie و Local Storage از `chromium.launchPersistentContext(userDataDir, options)` استفاده شود.

نکات:
- مسیر Profile باید دائمی و مختص Account باشد.
- Chromium اجازه استفاده هم‌زمان از یک User Data Directory توسط چند Instance را نمی‌دهد.
- Profile اصلی Chrome کاربر استفاده نشود.
- Browser در حالت Headed اجرا شود تا کاربر QR و Login را ببیند.
- Context با Shutdown کنترل‌شده بسته شود.
- Profile را با کپی‌کردن فایل‌های در حال استفاده Backup نکن.

## Selector Strategy
اولویت: Role و Accessible Name؛ Label و Placeholder؛ متن قابل مشاهده؛ Test ID در صورت وجود؛ CSS داخلی فقط آخرین گزینه و در Adapter متمرکز.
از XPath طولانی و CSS classهای hash شده اجتناب شود.

## Reliability
- تمام عملیات Timeout داشته باشند.
- قبل از کلیک، عنصر Visible و Enabled بررسی شود.
- بعد از عملیات، نتیجه در UI Verify شود.
- Screenshot فقط برای Debug محلی و با کنترل کاربر؛ در خروجی Agent ارسال نشود.
- در تغییر UI، عملیات متوقف شود.

## Versioning
نسخه Playwright و Browser باید سازگار و Pin باشند. بعد از Upgrade روی Profile کپی‌شده/آزمایشی تست کن؛ Profile اصلی را اولین بار با نسخه جدید باز نکن.
