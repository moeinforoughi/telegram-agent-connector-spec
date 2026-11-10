# Architecture Decision Records (ADR)

## ADR-001 — UI Automation به‌جای Telegram API Credentials
**تصمیم:** Playwright روی Telegram Web؛ بدون درخواست `api_id`, `api_hash` و Bot Token.
**دلیل:** تجربه اتصال ساده‌تر؛ Login از طریق QR/Phone در UI موجود.
**هزینه/ریسک:** شکنندگی Selectorها، تغییر UI، احتمال محدودیت یا تغییر رفتار Telegram Web، کندتر بودن نسبت به API.
**قانون:** هیچ endpoint داخلی، MTProto یا API خصوصی فراخوانی نشود.

## ADR-002 — Electron برای Windows Desktop
**تصمیم:** Electron + React + TypeScript.
**دلیل:** استفاده مجدد از Node.js/TypeScript، پشتیبانی از فایل‌ها و Processها، بسته‌بندی مناسب Windows.
**هزینه:** حجم نصب بیشتر و مصرف منابع بالاتر از Tauri.
**جایگزین:** Tauri فقط اگر اندازه و مصرف منابع بعداً به مسئله اثبات‌شده تبدیل شد؛ نه در MVP.

## ADR-003 — Modular Monolith
**تصمیم:** یک برنامه Electron با ماژول‌های جدا.
**رد شده:** Microservices، Docker، Redis، Kubernetes.

## ADR-004 — Playwright Persistent Context
**تصمیم:** `chromium.launchPersistentContext(userDataDir, ...)`.
**دلیل:** حفظ Cookie و Local Storage در پروفایل دائمی.
**قانون:** یک User Data Directory نباید هم‌زمان توسط چند Browser استفاده شود. از Profile اصلی Chrome کاربر استفاده نشود.

## ADR-005 — MCP STDIO + Local Named Pipe
**تصمیم:** Agent Host، MCP Bridge را به‌عنوان Child Process اجرا کند؛ Bridge از Named Pipe به Core متصل شود.
**دلیل:** سازگاری با MCP Clientهای محلی و جلوگیری از بازکردن HTTP Port.
**محدودیت:** Desktop App باید فعال باشد. اگر خاموش باشد، Tool خطای `CONNECTOR_NOT_RUNNING` بدهد.

## ADR-006 — JSON Storage در MVP
**تصمیم:** JSON برای Registry/Settings و JSONL برای Audit.
**دلیل:** کمینه‌کردن Dependency و پیچیدگی.
**مهاجرت:** SQLite فقط با شواهد نیاز واقعی.

## ADR-007 — Chromium Bundled در Installer
**تصمیم:** نسخه Playwright و Chromium Pin و Chromium سازگار همراه Installer قرار گیرد.
**دلیل:** عدم نیاز کاربر به نصب Node یا دانلود وابستگی در اولین اجرا؛ رفتار قابل تکرار.
**هزینه:** Setup بزرگ‌تر.

## ADR-008 — No AI Content Processing by Default
**تصمیم:** پردازش متن چت با LLM خاموش باشد.
**دلیل:** محدودیت Telegram Content Licensing و نیاز به رضایت صریح و مستمر کاربران مرتبط.
**شرط فعال‌سازی:** بررسی حقوقی و پیاده‌سازی Consent/Policy معتبر؛ صرفاً Local بودن پردازش به‌معنای مجاز بودن آن نیست.

## ADR-009 — Autonomous with Guardrails
**تصمیم:** عملیات کم‌ریسک و برگشت‌پذیر می‌توانند طبق Policy خودکار باشند؛ عملیات حساس تأیید لازم دارند.

## ADR-010 — No Background Polling in MVP
**تصمیم:** هیچ پایش دائمی چت‌ها در MVP انجام نشود.
**دلیل:** کاهش CPU، رفتار قابل پیش‌بینی، کاهش داده جمع‌آوری‌شده و کنترل Token Usage.

## ADR-011 — Telegram Web Variant: WebZ `/k/`
**تصمیم:** MVP فقط از `https://web.telegram.org/k/` (WebZ) استفاده کند. Variant `/a/` فعلاً پیاده‌سازی یا بررسی نشود.
**دلیل:** مسیر پیش‌فرض `web.telegram.org` در Phase 0 به `/k/` هدایت شد و ورود QR + 2FA، حفظ Session و خواندن فهرست چت با موفقیت تست شد.
**قانون:** تمام Selectorها در یک Adapter متمرکز باشند و تشخیص Login بر اساس Visibility عناصر باشد، نه صرفاً وجود آن‌ها در DOM.
**هزینه/ریسک:** وابستگی به DOM متغیر WebZ؛ تغییر UI باید `TELEGRAM_UI_CHANGED` بدهد و عملیات متوقف شود.

## ADR-012 — Pinned MVP Stack
**تصمیم:** نسخه‌های مبنا:
- Node.js `26.13.0` LTS
- Electron `45.2.3`
- Playwright `1.65.0`
- Chromium `158.0.8127.18` (Chrome for Testing، revision 1254؛ مخصوص Playwright)
- MCP TypeScript SDK `1.32.2`
- TypeScript `5.9.3`
- Zod `4.6.7`
**Runtimeهای واقعی Phase 1:** Electron 45.2.3 با Node داخلی `24.22.2` و Chromium داخلی `156.0.8078.80` اجرا می‌شود. ابزار Build/Test از Node `26.13.0` استفاده می‌کند. Chrome for Testing `158.0.8127.18` مخصوص Playwright/Phase 2 است و نباید با Chromium داخل Electron اشتباه شود.
**سازگاری Phase 1 (بررسی‌شده):** React 19.3.1؛ Vite 8.3.7؛ electron-vite 6.0.0؛ @vitejs/plugin-react 6.3.0؛ Vitest 5.1.0؛ ESLint 10.14.0؛ typescript-eslint 8.72.2؛ Prettier 3.9.10؛ `@types/node` 24.19.2 (هم‌راستا با Node داخلی Electron 45). نصب، Typecheck، Lint، Build و تست موفق.
**قانون:** نسخه‌ها و Lockfile Commit شوند و بدون دلیل فنی تغییر نکنند. سازگاری Peer Dependency در Phase 1 بررسی و ثبت شد.
**هزینه/ریسک:** ارتقای Playwright/Chromium می‌تواند روی Profile اثر بگذارد؛ ابتدا روی Profile آزمایشی تست شود.

## ADR-013 — Proxy Strategy: System Proxy First + Manual Fallback
**تصمیم:** ابتدا مسیر Proxy/VPN سیستم استفاده شود؛ اگر اتصال به Telegram Web برقرار نشد، خطای قابل فهم نمایش داده شود و در صورت نیاز تنظیم دستی HTTP یا SOCKS5 فراهم شود.
**ممنوع:** Hardcode کردن IP/Port، اسکن پورت‌های سیستم، ساخت Proxy Manager پیچیده، تغییر تنظیمات Proxy سایر برنامه‌ها، یا ثبت Credential پروکسی در Log.
**وضعیت:** تصمیم پذیرفته شده؛ پیاده‌سازی و اثبات خودکاربودن استفاده از Proxy سیستم در Phase 2 (Browser Manager) انجام شود.
**نکته Phase 0:** دسترسی مستقیم به Telegram مسدود بود و Phase 0 یک Proxy محلی را به‌صورت صریح به Playwright داد؛ استفاده خودکار از Proxy سیستم در Phase 0 اثبات نشده است.

## ADR-014 — Runtime Separation
**تصمیم:** Electron Main از Node Runtime داخلی Electron استفاده کند. MCP Bridge در زمان بسته‌بندی یک Node.js مستقل و Pin شده همراه برنامه داشته باشد.
**دلیل:** جلوگیری از اشتباه بین Runtime دسکتاپ و Runtime پردازه Bridge و حفظ رفتار قابل تکرار.
**قانون:** Playwright و Chromium نسخه سازگار و Pin شده داشته باشند و Chromium همراه Installer توزیع شود؛ برنامه در اولین اجرا Browser دانلود نکند.
**وضعیت Phase 1:** Electron Main با Node داخلی `24.22.2` اجرا می‌شود؛ ابزار Build/Test از Node `26.13.0` استفاده می‌کند. Chromium داخل Electron (`156.0.8078.80`) فقط Renderer برنامه است؛ Browser Manager در Phase 2 از Playwright و Chromium Pin‌شده استفاده خواهد کرد. MCP Bridge در Phase 5 با Node مستقل Pin‌شده بسته‌بندی می‌شود.

## ADR-015 — Playwright به‌عنوان Runtime Dependency با Import Lazy
**تصمیم:** `playwright` در `dependencies` بماند (نه `devDependencies`)، توسط electron-vite به‌صورت External در نظر گرفته شود، و فقط در لحظه Launch داخل `createPlaywrightLauncher()` با `import()` بارگذاری شود.
**دلیل:** Bundle کردن Playwright و Driver آن شکننده است؛ External نگه‌داشتن آن مسیر Node Resolution واقعی را حفظ می‌کند. Import Lazy باعث می‌شود Startup برنامه و Unit Testها بدون بارگذاری Browser Stack اجرا شوند.
**محدودیت:** بسته نهایی باید `node_modules/playwright` و Chromium سازگار را همراه داشته باشد؛ نسخه Playwright و Revision Chromium باید Pin بمانند (ADR-012). مسیر Browser در Development با `PLAYWRIGHT_BROWSERS_PATH` تعیین می‌شود و وابستگی به Bundle نهایی تا Phase 6 باز است.
**اثر:** `src/core/browser/browser-factory.ts` و `src/main/index.ts`؛ تست Integration با Chromium واقعی و تست E2E بارگذاری Playwright از Main.
**وضعیت تست:** Integration و E2E سبز؛ بسته‌بندی Chromium در Phase 6.

## ADR-016 — مدل Account IPC و View بدون مسیر
**تصمیم:** تمام قابلیت‌های Account فقط از طریق شش Channel Allowlistشده (`account:get|start|stop|open|remove` به‌همراه `app:get-info`) و یک Event (`account:status`) ارائه شوند. Router از Handler Map تایپ‌شده و Dispatch صریح استفاده کند، Payload مربوط به `account:remove` را Validate کند، و Renderer فقط `AccountView` بدون Path/Credential بگیرد.
**دلیل:** حفظ جداسازی Renderer از Node و فایل‌های Session؛ جلوگیری از نشت Profile Path و Proxy Credential؛ افزودن Channel جدید را به یک تغییر صریح و قابل بازبینی تبدیل می‌کند.
**محدودیت:** هر Channel جدید نیازمند تغییر Allowlist، Preload، Router و تست است. نتیجه همیشه در Envelope `{ ok, data | error }` برمی‌گردد و خطاهای ناشناخته به `INTERNAL_ERROR` تبدیل می‌شوند.
**اثر:** `src/shared/ipc.ts`، `src/shared/account.ts`، `src/main/ipc-router.ts`، `src/preload/index.ts`، `src/renderer/src/App.tsx`.
**وضعیت تست:** Unit برای Allowlist/Trusted Sender/Validation و E2E برای سطح Preload و Dashboard.

## ADR-017 — قفل Profile در سطح برنامه به‌علاوه قفل Chromium
**تصمیم:** علاوه بر Singleton Lock خود Chromium، یک `profile.lock` شامل `{ pid, createdAt }` با فلگ `wx` ساخته شود. اگر Lock متعلق به PID زنده باشد `PROFILE_LOCKED` برگردد؛ Lock کهنه یا Malformed جایگزین شود؛ Profile در Recovery هرگز حذف نشود؛ Release فقط توسط همان PID انجام شود.
**دلیل:** جلوگیری از دو Context هم‌زمان روی یک Profile و امکان بازیابی پس از Crash بدون از دست دادن Session.
**محدودیت:** Reuse شدن PID می‌تواند Lock کهنه را به‌اشتباه زنده تلقی کند؛ `EPERM` به‌معنای زنده بودن Process در نظر گرفته می‌شود؛ Lock فقط محلی و Per-User است و جایگزین قفل Chromium نیست.
**اثر:** `src/core/browser/profile-lock.ts`، `browser-manager.ts`، `account-controller.ts`.
**وضعیت تست:** Unit برای Live/Stale/Malformed/Release و Integration برای رد Context دوم.

## ADR-018 — ترتیب، اعتبارسنجی و افشاگری Proxy Resolution
**تصمیم:** ترتیب منبع Proxy: `CONNECTOR_PROXY_SERVER` → `SPIKE_PROXY` → WinINET Registry → Environment → Direct. مقدار صریح نامعتبر باید `PROXY_ERROR` بدهد و هرگز بی‌صدا Direct نشود. Registry و Environment بهترین‌تلاش‌اند. اعتبارسنجی فقط `http`/`https`/`socks5` با Host و Port صریح را بپذیرد. Credential جدا و Redact شود و هرگز Log/IPC/Storage نشود. Proxy به‌صورت صریح به Playwright داده شود.
**دلیل:** Phase 0 فقط Proxy صریح را اثبات کرده بود؛ استفاده خودکار از Proxy سیستم اثبات نشده بود. این ترتیب منبع واقعی را قابل تشخیص و قابل گزارش می‌کند و از Hardcode و Port Scanning پرهیز می‌کند (ADR-013).
**محدودیت:** وقتی Resolution برابر `direct` است، Chromium ممکن است همچنان Proxy سیستم ویندوز را خودش اعمال کند؛ این حالت به منبعی نسبت داده نمی‌شود. صحت خواندن Registry در محیط واقعی و Inheritance سیستم هنوز Live-تست نشده است. احراز هویت SOCKS5 با Chromium/Playwright تست نشده و VPN/TUN مدل نشده است.
**اثر:** `src/core/network/proxy-resolver.ts`، `windows-proxy.ts`، `account-controller.ts`، `browser-factory.ts`.
**وضعیت تست:** Unit برای Priority/Validation/Bypass/Auth/Redaction و Registry Parsing؛ Integration برای HTTP Proxy با Credential و Bypass؛ Live Pending.

## ADR-019 — بارگذاری Playwright در E2E از Main و پرهیز از IPC تستی
**تصمیم:** تست E2E برای اثبات بارگذاری Playwright در Electron Main از `process.mainModule.require("<appPath>/node_modules/playwright")` استفاده کند و هیچ Channel یا Self-Test مخصوص تست به Preload/Production اضافه نشود. برای اجرای E2E، متغیر `ELECTRON_RUN_AS_NODE` فقط در Environment فرزند حذف شود.
**دلیل:** `app.evaluate` امکان Dynamic Import را نمی‌دهد و افزودن سطح API تستی، سطح حمله Production را بزرگ می‌کند.
**محدودیت:** `process.mainModule` در Node منسوخ (Deprecated) است و فقط در Main از نوع CJS کار می‌کند؛ این روش Test-Only است و اگر Electron Main به ESM منتقل شود باید جایگزین شود. `ELECTRON_RUN_AS_NODE` یک متغیر محیطی خارج از برنامه است و نباید در Windows به‌صورت دائمی تغییر کند.
**اثر:** `tests/e2e/app.test.ts` و Environment اجرای تست.
**وضعیت تست:** E2E سبز؛ محدودیت Runtime مستند شده است.
