# Known Limitations

1. این برنامه از Telegram Web UI استفاده می‌کند؛ UI ممکن است تغییر کند.
2. پایداری آن به اندازه API رسمی/ساختاریافته نیست.
3. نشست Telegram ممکن است از طرف کاربر یا Telegram لغو شود.
4. QR Login و Phone Login باید در UI خود Telegram انجام شوند.
5. هیچ تضمینی برای پشتیبانی همه عملیات Telegram Web وجود ندارد.
6. Browser Profile حاوی داده حساس است.
7. Browserها منابع RAM/CPU مصرف می‌کنند؛ Lazy-start ضروری است.
8. MCP Client فقط زمانی می‌تواند به Core متصل شود که Desktop App فعال باشد.
9. اگر Agent داخل Cloud باشد، به Profile محلی دسترسی مستقیم ندارد.
10. AI processing of Telegram content is restricted by Telegram's current Content Licensing terms unless the specified consent exception applies.
11. تغییر نسخه Playwright/Chromium می‌تواند روی Profile اثر بگذارد؛ Upgrade باید کنترل‌شده باشد.
12. UI Automation نباید برای Spam، Mass Messaging یا دورزدن محدودیت‌های Telegram استفاده شود.
