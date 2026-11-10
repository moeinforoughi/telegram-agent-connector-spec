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
- Chromium `158.0.8127.18` (Chrome for Testing، revision 1254)
- MCP TypeScript SDK `1.32.2`
- TypeScript `5.9.3`
- Zod `4.6.7`
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
