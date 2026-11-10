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

## استقلال از سشن (قانون دائمی)

پروژه نباید به حافظه Agent، Context Window، گفتگوهای قبلی، سشن فعال یا حافظه
موقت مدل وابسته باشد. هر Coding Agent باید فقط با مطالعه Repository بتواند از
آخرین Checkpoint معتبر ادامه دهد.

### قبل از شروع هر سشن
- `AGENTS.md`، `docs/PROJECT_STATE.md` و `docs/handoff/LATEST_HANDOFF.md` را بخوان.
- Task فعال را پیدا کن و `docs/handoff/RESUME_PROMPT.md` را بخوان.
- `git status`، `git branch --show-current`، `git log --graph --oneline -20` و
  `git diff` را بررسی کن.
- تغییرات Commit‌نشده را حفظ کن؛ هیچ تغییر موجودی را بدون بررسی حذف یا
  بازنویسی نکن.
- آخرین نتیجه تست‌ها را از Handoff و با اجرای واقعی بررسی کن.

### در طول توسعه
- بعد از هر Task منطقی، وضعیت Task، فایل‌های تغییرکرده، نتایج تست، مشکلات
  باقی‌مانده و تصمیمات جدید را ثبت کن.
- `docs/handoff/LATEST_HANDOFF.md` و `docs/handoff/SESSION_LOG.md` را به‌روز کن.
- اگر احتمال اتمام Context وجود دارد، توسعه قابلیت جدید را متوقف کن و ابتدا
  Checkpoint و Handoff بساز.
- هیچ تصمیم مهم، دلیل معماری، محدودیت یا اطلاعات لازم برای ادامه توسعه نباید
  فقط در چت باقی بماند؛ باید در Repository ثبت شود.

### قبل از پایان هر سشن
`docs/PROJECT_STATE.md`، `docs/handoff/LATEST_HANDOFF.md` و
`docs/handoff/SESSION_LOG.md` باید شامل این موارد باشند:

- آخرین Commit و Branch.
- وضعیت Working Tree.
- فاز و Task فعال.
- Taskهای تکمیل‌شده.
- فایل‌های تغییرکرده.
- تست‌های اجراشده و نتیجه واقعی آن‌ها.
- مشکلات باقی‌مانده و Blockerها.
- اولین اقدام بعدی.

Handoff باید به‌اندازه‌ای دقیق باشد که یک Agent جدید بدون هیچ سؤالی درباره سشن
قبلی بتواند کار را ادامه دهد.

### Source of Truth
در صورت مغایرت بین چت، Handoff، مستندات و کد: ابتدا Git، کد واقعی و شواهد تست
را بررسی کن؛ سپس مستندات را با وضعیت واقعی تطبیق بده. هیچ تغییر مخربی صرفاً بر
اساس یک گزارش قدیمی انجام نده.

### مرجع وضعیت
- `docs/PROJECT_STATE.md` — وضعیت کلان پروژه.
- `docs/handoff/LATEST_HANDOFF.md` — Checkpoint فعلی.
- `docs/handoff/SESSION_LOG.md` — تاریخ append-only.
- `docs/handoff/RESUME_PROMPT.md` — دستور شروع سشن.
- `docs/architecture/IMPLEMENTED_ARCHITECTURE.md` — معماری واقعی پیاده‌شده.

## Definition of Done
- Acceptance Criteria پاس شده باشد.
- تست جدید و Regression Test اجرا شده باشند.
- Typecheck و Lint موفق باشند.
- خطاها و محدودیت‌ها مستند شده باشند.
- Secret یا داده واقعی در Diff نباشد.
- مستندات مرتبط به‌روزرسانی شده باشند.
- فایل‌های وضعیت و Handoff به‌روز شده باشند.
- Commit با پیام معنادار ثبت شده باشد.
