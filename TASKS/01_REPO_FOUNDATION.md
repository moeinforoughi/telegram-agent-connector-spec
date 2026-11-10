# TASK 01 — Repository Foundation

Priority: P0 | Depends on: TASK 00 | Commit: `chore: initialize desktop project`

## Objective
ساخت اسکلت کمینه و قابل تست Electron + React + TypeScript.

## Work Items
- [x] Repository و package manager را آماده کن.
- [x] نسخه Node/Electron/Playwright را Pin کن.
- [x] Electron Main، Preload و Renderer را جدا کن.
- [x] TypeScript strict فعال کن.
- [x] ESLint و Formatter اضافه کن.
- [x] Unit Test Runner اضافه کن.
- [x] Scriptهای `dev`, `build`, `lint`, `typecheck`, `test` بساز.
- [x] Error handler پایه اضافه کن.
- [x] App data path را با Electron `app.getPath('userData')` مدیریت کن.
- [x] هیچ Account/Browser/MCP Feature اضافه نکن.

## Tests First
- [x] تست مسیر داده.
- [x] تست validation تنظیمات پایه.
- [x] تست Error serialization.
- [x] تست renderer isolation.
- [x] تست startup/shutdown.

## Acceptance
- [x] برنامه در Development اجرا شود.
- [x] Renderer به Node دسترسی مستقیم نداشته باشد.
- [x] Typecheck/Lint/Test موفق باشند.
- [x] هیچ Secret یا فایل کاربر در Repository نباشد.

## Result (2026-11-10)

**Status: Complete — Phase 1.**

- Repository: یک npm package، نسخه‌های Exact و `package-lock.json` Commit‌شده.
- Runtime: Electron 45.2.3 با Node داخلی 24.22.2 و Chromium 156.0.8078.80؛ Build/Test با Node 26.13.0.
- Security: `contextIsolation` و `sandbox` فعال، `nodeIntegration` خاموش، IPC Allowlist، بررسی Sender، CSP سخت‌گیرانه در Production، مسدودبودن Navigation، Redirect، Subframe و Window جدید، رد تمام Permissionها، و محدودبودن Dev Server URL به Loopback.
- Data path: `%LOCALAPPDATA%\UnofficialTelegramAgentConnector`؛ Override تست با `CONNECTOR_USER_DATA_DIR` فقط در Build غیرPackaged؛ مسیرها به Renderer ارسال نمی‌شوند.
- Tests: 28 Unit + 6 Electron E2E؛ همه Pass.
- Build: `npm run build` موفق؛ Renderer Minified حدود 220.5 kB.
- Development: `npm run dev` با Vite روی `localhost:5173` و Electron اجرا شد؛ Process باقی‌مانده نبود.
- خارج از Phase 1: Browser Manager، Account، MCP، Telegram Automation، SQLite، Proxy Manager، Auto Update.
- Proxy: پیاده‌سازی D-006 به Phase 2 موکول شد؛ Phase 1 مرورگر ندارد.
- Report: `docs/phase1/PHASE1_REPORT.md`.
- Commit: `chore: initialize electron repository`.
- محدودیت: Electron 45 دیگر `getLastWebPreferences` را ارائه نمی‌دهد؛ گزینه‌های امنیتی در Unit Test و Isolation واقعی در E2E تست شده‌اند.
