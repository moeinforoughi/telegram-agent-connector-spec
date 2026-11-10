# Architecture

## 1. سبک معماری

**Modular Monolith با یک Desktop Host محلی**. در MVP هیچ Microservice، Docker، Remote Server، Redis، Message Broker یا دیتابیس سنگین نداریم.

## 2. اجزای اجرایی

### Electron Desktop Host
- مالک برنامه و وضعیت اجرای Core.
- نمایش UI با React.
- مدیریت Lifecycle برنامه و System Tray.
- راه‌اندازی Browser Manager.
- ارائه Named Pipe محلی برای MCP Bridge.
- نگهداری مسیرهای داده محلی.

### Renderer
- فقط رابط کاربری.
- بدون دسترسی مستقیم به Node، Profile، فایل یا شبکه داخلی.
- ارتباط با Main فقط از طریق API محدود Preload.
- تمام ورودی‌ها در Main دوباره Validate شوند.

### Connector Core
- Account Registry.
- Account Lifecycle.
- Browser Manager.
- Telegram Web Adapter.
- Per-account Task Queue.
- Permission Policy.
- Audit Logger.
- Local IPC Server.

### Browser Manager
- برای هر Account یک Persistent Browser Context.
- Chromium در حالت Headed.
- Profile Directory مستقل.
- Browserها Lazy-start.
- هر Profile فقط یک Owner فعال.
- Browser Context هنگام خروج برنامه به‌درستی بسته شود تا Profile سالم بماند.

### Telegram Web Adapter
- فقط UI Automation با Locatorهای قابل مشاهده.
- آدرس شروع `https://web.telegram.org/`.
- Selectorها در یک لایه متمرکز.
- تشخیص حالت Login، QR، Chat List و خطا.
- هیچ API داخلی یا Network Endpoint خصوصی فراخوانی نشود.

### MCP Bridge
- یک Process سبک Node.js که توسط MCP Client با STDIO اجرا می‌شود.
- Schema ابزارها را ثبت می‌کند.
- درخواست را از طریق Named Pipe به Core می‌فرستد.
- خروجی Core را به MCP Result تبدیل می‌کند.
- Log فقط به stderr.
- اگر Core خاموش باشد، خطای واضح می‌دهد؛ در MVP خودش Browser یا Core را اجرا نمی‌کند.

## 3. Data Flow

### Login
1. کاربر در UI روی Add Account می‌زند.
2. Core یک Account ID و Profile Directory ایجاد می‌کند.
3. Browser Manager یک Persistent Context باز می‌کند.
4. Telegram Web در پنجره قابل مشاهده باز می‌شود.
5. کاربر QR را اسکن می‌کند یا اطلاعات را مستقیماً در Telegram Web وارد می‌کند.
6. Adapter وضعیت ورود را بررسی می‌کند.
7. Core وضعیت Account را Connected می‌کند.
8. هیچ credential به MCP یا LLM ارسال نمی‌شود.

### Agent Tool Call
1. MCP Client، MCP Bridge را با STDIO اجرا می‌کند.
2. Bridge به Named Pipe Core متصل می‌شود.
3. Tool input با Zod اعتبارسنجی می‌شود.
4. Core مجوز و وضعیت Account را بررسی می‌کند.
5. Task وارد Queue همان Account می‌شود.
6. Adapter عملیات محدود UI را انجام می‌دهد.
7. نتیجه خلاصه و بدون Secret برمی‌گردد.

## 4. IPC Contract

- Windows Named Pipe محلی.
- نام Pipe نسخه‌دار و مخصوص کاربر/نصب.
- پیام‌ها JSON خطی با `requestId`, `version`, `method`, `params`.
- سقف اندازه پیام.
- Timeout برای هر درخواست.
- فهرست Methodها ثابت و Allowlist باشد.
- هیچ Method عمومی برای اجرای کد یا فرمان دلخواه وجود نداشته باشد.
- دسترسی Pipe باید به کاربر محلی محدود و در تست Windows بررسی شود.
- اگر ACL مناسب با راهکار Node قابل تضمین نبود، از Pipe با نام تصادفی + Secret تصادفی با ACL محدود استفاده شود؛ از بازکردن Port عمومی خودداری شود.

## 5. Account State Machine

`DISCONNECTED -> INITIALIZING -> WAITING_FOR_LOGIN -> AUTHENTICATING -> CONNECTED`

حالت‌های خطا: `LOGIN_REQUIRED`, `SESSION_EXPIRED`, `BROWSER_CLOSED`, `NETWORK_ERROR`, `UI_CHANGED`, `PROFILE_LOCKED`, `ERROR`.

انتقال وضعیت فقط توسط Core انجام شود. Agent اجازه تغییر مستقیم State را ندارد.

## 6. Concurrency

- یک Profile فقط یک Browser Context فعال.
- عملیات یک Account سریالی.
- عملیات اکانت‌های مستقل می‌توانند مستقل اجرا شوند، اما سقف Browser فعال قابل تنظیم باشد.
- در MVP حداکثر سه Account برای تست رسمی.
- درخواست‌های هم‌زمان روی یک Account در Queue قرار گیرند.
- عملیات ارسال پیام در حالت `OUTCOME_UNKNOWN` Retry خودکار نشود.

## 7. Storage

در MVP:
- `accounts.json`: شناسه، عنوان، مسیر Profile، وضعیت آخرین اجرا و زمان ایجاد.
- `policies.json`: Policyهای مجاز.
- `audit.jsonl`: رویدادهای عملیاتی بدون محتوای پیام.
- `profiles/<accountId>/`: داده دائمی Chromium.
- `logs/`: Log فنی Redacted.

SQLite فقط وقتی اضافه شود که نیاز واقعی مانند Query پیچیده، حجم بالای Audit یا تراکنش اتمیک اثبات شود.

## 8. Browser Lifecycle

- برنامه باز می‌شود؛ Core بالا می‌آید.
- Browserها خودکار همگی باز نمی‌شوند.
- هنگام Connect یا Tool Call، Browser مربوط به Account فعال می‌شود.
- هنگام Close، Context بسته می‌شود و Profile حفظ می‌شود.
- اگر برنامه به‌صورت ناگهانی بسته شد، در اجرای بعدی Profile Lock بررسی شود.
- هیچ‌گاه یک Profile را با حذف کورکورانه Lock File آزاد نکن.
- Profile Corruption باید با Backup/Restore یا درخواست Login مجدد مدیریت شود.

## 9. Error Strategy

خطاها باید کد ثابت داشته باشند:
- `CONNECTOR_NOT_RUNNING`
- `ACCOUNT_NOT_FOUND`
- `ACCOUNT_NOT_CONNECTED`
- `LOGIN_REQUIRED`
- `PROFILE_LOCKED`
- `BROWSER_LAUNCH_FAILED`
- `TELEGRAM_UI_CHANGED`
- `UNSUPPORTED_OPERATION`
- `PERMISSION_DENIED`
- `COMPLIANCE_GATE_BLOCKED`
- `RATE_LIMIT_OR_FLOOD_WAIT`
- `OUTCOME_UNKNOWN`
- `TIMEOUT`
- `INTERNAL_ERROR`

خطاها نباید HTML خام، متن کامل چت، Cookie یا Secret را برگردانند.
