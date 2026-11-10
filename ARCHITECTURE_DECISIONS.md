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
