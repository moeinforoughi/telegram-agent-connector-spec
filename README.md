# Unofficial Telegram Agent Connector — Project Specification

این Repository شامل **بسته مشخصات فنی و اجرایی** و **پیاده‌سازی تدریجی MVP** است. Phase 0 (امکان‌سنجی) و Phase 1 (Repository Foundation) تکمیل شده‌اند؛ فازهای بعدی فقط با تأیید کاربر ادامه پیدا می‌کنند. بسته مشخصات شامل نقشه راه، معماری، تسک‌ها، تست‌ها، قراردادها و دستورالعمل‌های لازم برای ساخت محصول است.

## هدف محصول

ساخت یک برنامه دسکتاپ محلی برای Windows که به کاربر اجازه دهد اکانت‌های واقعی Telegram خود را از طریق رابط قابل مشاهده Telegram Web و بدون درخواست `api_id`، `api_hash` یا Bot Token متصل کند. برنامه باید نشست مرورگر را به‌صورت محلی نگه دارد و قابلیت‌های کنترل‌شده را از طریق یک MCP Server اختصاصی در اختیار ایجنت‌ها قرار دهد.

> نام محصول در UI و توزیع باید با عبارت **Unofficial** همراه باشد و نباید وابستگی یا تأیید رسمی Telegram را القا کند. از لوگوی رسمی Telegram استفاده نشود.

## وضعیت پیاده‌سازی

- **Phase 0 — Feasibility:** تکمیل و تأیید شد. Telegram Web (WebZ `/k/`) با ورود QR + 2FA دستی، حفظ Session، خواندن فهرست چت و قفل Profile آزمایش شد. گزارش: `docs/spike/PHASE0_REPORT.md`
- **Phase 1 — Repository Foundation:** تکمیل شد. اسکلت امن Electron + React + TypeScript، IPC Allowlist، مسیر داده محلی، Typecheck/Lint/Format/Unit/E2E. گزارش: `docs/phase1/PHASE1_REPORT.md`

Phase 2 (Browser Manager) هنوز شروع نشده و منتظر تأیید کاربر است.

## تصمیم‌های اصلی

- Windows-first؛ هدف اولیه Windows 11 x64 است.
- برنامه دسکتاپ با Electron + React + TypeScript.
- اتوماسیون رابط کاربری با Playwright و Chromium قابل مشاهده.
- ورود فقط توسط خود کاربر در پنجره مرورگر؛ QR یا ورود با شماره.
- هیچ `api_id`، `api_hash`، Bot Token یا رمز تلگرام از طریق MCP دریافت نمی‌شود.
- هر اکانت یک پروفایل دائمی و مستقل Chromium دارد.
- MCP اختصاصی با Transport نوع STDIO.
- MCP Bridge از طریق Windows Named Pipe به برنامه محلی متصل می‌شود.
- معماری Modular Monolith؛ بدون Microservice.
- Docker در MVP وجود ندارد.
- تنظیمات و متادیتا در JSON؛ لاگ ممیزی در JSONL. دیتابیس در MVP لازم نیست.
- عملیات ساده و قطعی با کد محلی انجام می‌شوند؛ LLM فقط در صورت نیاز و مجاز بودن پردازش محتوا استفاده می‌شود.
- پردازش محتوای چت توسط AI به‌صورت پیش‌فرض غیرفعال است؛ قبل از فعال‌سازی باید الزامات Telegram Content Licensing و رضایت کاربران بررسی و تأیید شود.

## ترتیب مطالعه

1. `AGENTS.md` — دستورالعمل اجباری ایجنت کدنویس
2. `PROJECT_BRIEF.md` — تعریف محصول و محدوده
3. `REQUIREMENTS.md` — نیازمندی‌های عملکردی و غیرعملکردی
4. `ARCHITECTURE.md` و `ARCHITECTURE_DECISIONS.md`
5. `PROJECT_TREE.md` — ساختار سورس مورد انتظار
6. `MCP_CONTRACT.md` — قرارداد ابزارهای MCP
7. `SECURITY_THREAT_MODEL.md` و `PRIVACY_AND_COMPLIANCE.md`
8. `ROADMAP.md` و فایل‌های `TASKS/`
9. `TEST_STRATEGY.md` و `TEST_MATRIX.md`
10. `RELEASE_AND_PACKAGING.md`

## اجرا و توسعه

پیش‌نیاز: Node.js `26.13.0` LTS و npm.

```text
npm install
npm run dev        # Vite + Electron
npm run build      # Production build in out/
npm start          # Preview the built app
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check      # all quality gates
```

نکته‌ها:

- Electron Main از Node داخلی Electron استفاده می‌کند؛ Build/Test از Node 26.13.0.
- Chromium داخل Electron فقط Renderer برنامه است. Chrome for Testing مخصوص Playwright در Phase 2 برای Browser Manager استفاده می‌شود.
- در شبکه‌های محدود، دانلود Electron/Chromium در زمان نصب ممکن است به Proxy یا Mirror محیط Build نیاز داشته باشد. هیچ Proxy در برنامه Hardcode نشده است.
- Phase 1 به Telegram وارد نمی‌شود و داده اکانت ذخیره نمی‌کند.

ساختار سورس: `src/main`، `src/preload`، `src/renderer`، `src/shared`، `tests/unit`، `tests/e2e`.

## دستور شروع

ایجنت باید فازها را به ترتیب اجرا کند. Phase 0 و Phase 1 انجام شده‌اند. Phase 2 فقط پس از تأیید گزارش Phase 1 شروع شود. در Phase 2 ابتدا D-006 (System Proxy First + Manual Fallback) پیاده‌سازی و اثبات می‌شود؛ سپس Browser Manager. تا زمانی که ورود واقعی بدون API credentials، حفظ نشست پس از Restart و بازیابی پروفایل اثبات نشده، توسعه قابلیت‌های گسترده شروع نشود.

## محدودیت مهم

این بسته تضمین نمی‌کند که Telegram Web همیشه بدون تغییر باقی بماند یا اتوماسیون آن از نظر شرایط استفاده Telegram مجاز باشد. Telegram Web ممکن است تغییر کند، ورود مجدد بخواهد یا رفتار اتوماسیون را محدود کند. محصول باید در چنین شرایطی **Fail Closed** عمل کند: عملیات را متوقف کند، علت را گزارش دهد و از حدس‌زدن یا اجرای عملیات پرریسک خودداری کند.
