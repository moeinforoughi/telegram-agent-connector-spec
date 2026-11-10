# AGENTS.md — قواعد دائمی توسعه

این فایل برای تمام ایجنت‌های کدنویس و تمام جلسات توسعه معتبر است.

## اولویت تصمیم‌ها
1. امنیت و حریم خصوصی
2. رعایت شرایط استفاده و محدودیت‌های Telegram
3. صحت عملکرد و جلوگیری از عملیات اشتباه
4. سادگی و قابلیت نگهداری
5. کارایی و مصرف منابع
6. زیبایی و امکانات جانبی

## اصول معماری
- Modular Monolith؛ یک Repository و یک برنامه محلی.
- Electron Main Process مالک Core و Browser Manager است.
- Renderer فقط UI است و مستقیماً به Node.js یا فایل‌های Session دسترسی ندارد.
- Preload فقط APIهای محدود و اعتبارسنجی‌شده را expose می‌کند.
- MCP Server یک Process مستقل با STDIO است.
- MCP Bridge فقط از طریق Windows Named Pipe به Core وصل می‌شود.
- Core مالک مرورگرها و Profileها است.
- هر Profile فقط یک Browser Context فعال دارد.
- عملیات هر Account سریالی اجرا می‌شوند.
- Browserها Lazy-start شوند؛ در شروع برنامه همه اکانت‌ها باز نشوند.

## عدم انجام
- Telegram Bot API، MTProto، Telethon، GramJS، `api_id`، `api_hash` یا Bot Token اضافه نکن.
- از endpointهای داخلی Telegram یا شبکه‌کاوی برای دورزدن رابط کاربری استفاده نکن.
- Browser automation عمومی، `evaluate` دلخواه، shell یا اجرای کد دلخواه را به MCP ارائه نکن.
- اطلاعات ورود را در فرم داخلی برنامه جمع‌آوری نکن؛ ورود داخل Telegram Web و توسط کاربر باشد.
- از Remote Browser، VNC، Docker یا Cloud در MVP استفاده نکن.
- از سرویس ابری برای ذخیره Profile یا پیام‌ها استفاده نکن.
- محتوای پیام‌ها را بدون مجوز و رضایت لازم به LLM ارسال نکن.
- ابزار Bulk Messaging، Spam، Mass Invite یا دورزدن Rate Limit نساز.

## قواعد کدنویسی
- TypeScript strict فعال باشد.
- `any` فقط با دلیل مستند و در محدوده کوچک مجاز است.
- تابع‌ها کوچک و تک‌مسئولیتی باشند.
- Errorها کد ثابت و قابل تشخیص داشته باشند.
- Timeout برای تمام عملیات Browser تعریف شود.
- ورودی MCP با Zod اعتبارسنجی شود.
- خروجی MCP محدود، ساختاریافته و بدون داده حساس باشد.
- تمام Selectorهای Telegram Web در یک لایه نگهداری شوند.
- در صورت تغییر UI یا عدم قطعیت، عملیات متوقف شود.
- تست قبل از Implementation نوشته شود.
- هر Task پس از تست موفق Commit شود.

## Definition of Done
- Acceptance Criteria پاس شده باشد.
- تست جدید و Regression Test اجرا شده باشند.
- Typecheck و Lint موفق باشند.
- خطاها و محدودیت‌ها مستند شده باشند.
- Secret یا داده واقعی در Diff نباشد.
- مستندات مرتبط به‌روزرسانی شده باشند.
- Commit با پیام معنادار ثبت شده باشد.
