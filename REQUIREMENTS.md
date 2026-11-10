# Product Requirements

## Functional Requirements

### FR-01 — First Run
- برنامه در اولین اجرا مسیر داده محلی را بسازد.
- نسخه Playwright و Chromium Pin باشند.
- اگر Browser Runtime موجود نیست، نصب/بازیابی با Progress و خطای قابل فهم انجام شود.
- هیچ Telegram credential درخواست نشود.

### FR-02 — Account Connection
- کاربر بتواند اکانت جدید اضافه کند.
- برای هر اکانت UUID و Profile Directory مستقل ایجاد شود.
- مرورگر قابل مشاهده باز و به `https://web.telegram.org/` هدایت شود.
- QR Login و Phone Login از طریق خود صفحه Telegram انجام شوند.
- کد تأیید و رمز دومرحله‌ای از طریق MCP یا فرم داخلی برنامه دریافت نشوند.
- وضعیت Login قابل مشاهده باشد.

### FR-03 — Session Persistence
- از Playwright Persistent Context استفاده شود.
- Profile پس از Restart حفظ شود.
- هیچ Profile برای بیش از یک Browser Context هم‌زمان باز نشود.
- اگر Session معتبر نیست، `LOGIN_REQUIRED` برگردد.

### FR-04 — Multi-account
- افزودن، نام‌گذاری، مشاهده وضعیت و حذف اکانت.
- Profile مستقل برای هر Account.
- Browser به‌صورت Lazy-start.
- قفل مستقل برای هر Profile.
- حذف اکانت با تأیید روشن کاربر.

### FR-05 — Browser Operations
- تمام عملیات Telegram Web از یک Adapter انجام شوند.
- Selectorها در یک لایه متمرکز باشند.
- Timeout و Retry محدود تعریف شود.
- در UI_CHANGED، AUTH_REQUIRED یا عدم قطعیت عملیات متوقف شود.
- از API داخلی یا endpoint خصوصی استفاده نشود.

### FR-06 — MCP
- MCP Server با STDIO کار کند.
- MCP Bridge به Core محلی متصل شود.
- ابزارها Schema مشخص و ورودی Validate شده داشته باشند.
- stdout فقط برای پیام‌های MCP باشد؛ Logها به stderr بروند.
- اگر Desktop Core در دسترس نیست، `CONNECTOR_NOT_RUNNING` برگردد.
- هیچ Tool برای اجرای کد دلخواه یا کنترل عمومی مرورگر ارائه نشود.

### FR-07 — Low Token Usage
- ابزارهای MCP سطح‌بالا و کم‌تعداد باشند.
- خروجی پیش‌فرض فقط Summary و Metadata محدود باشد.
- هیچ Screenshot یا DOM کامل به Agent ارسال نشود.
- هیچ Polling دائمی در MVP نباشد.
- نتایج با `limit` و `cursor` محدود شوند.
- خواندن محتوا فقط در فراخوانی صریح و پس از عبور از Compliance Gate ممکن باشد.

### FR-08 — Autonomous Policy
- عملیات کم‌ریسک و برگشت‌پذیر می‌توانند طبق Policy خودکار باشند.
- ارسال پیام فقط با Policy صریح و پس از بررسی الزامات قانونی/رضایت فعال شود.
- حذف پیام/چت، ترک گروه، Block، تغییر امنیتی و عملیات انبوه نیازمند تأیید باشند یا در MVP غیرفعال بمانند.
- پیام دریافتی از Telegram هرگز دستور سیستمی Agent تلقی نشود.

### FR-09 — Local UI
- نمایش فهرست اکانت‌ها و وضعیت آن‌ها.
- Add Account، Open Browser، Reconnect، Remove Account.
- نمایش وضعیت MCP و دستور اتصال به Agent.
- نمایش خطاهای قابل فهم، بدون Secret یا متن خصوصی.
- گزینه Start with Windows اختیاری باشد.

### FR-10 — Audit
- عملیات مهم با زمان، Account ID، نام Tool، نتیجه و Correlation ID ثبت شوند.
- متن پیام، کد ورود، رمز، Cookie، Local Storage و Session در Audit Log ثبت نشوند.

## Non-functional Requirements
- NFR-01: اجرای محلی و بدون نیاز به Cloud.
- NFR-02: عدم نیاز به نصب دستی Node.js، Python یا Docker.
- NFR-03: TypeScript strict.
- NFR-04: پایداری با یک تا سه اکانت فعال در MVP.
- NFR-05: Browserها Lazy-start شوند.
- NFR-06: Fail Closed در خطاهای UI یا Session.
- NFR-07: هیچ داده حساس در Log، Crash Report یا Telemetry ارسال نشود.
- NFR-08: Installer قابل نصب برای کاربر عادی، بدون Administrator در حالت عادی.
- NFR-09: تست روی Windows تمیز.
- NFR-10: نسخه‌های Electron، Node، Playwright و Chromium Pin شوند.
