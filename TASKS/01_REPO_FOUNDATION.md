# TASK 01 — Repository Foundation

Priority: P0 | Depends on: TASK 00 | Commit: `chore: initialize desktop project`

## Objective
ساخت اسکلت کمینه و قابل تست Electron + React + TypeScript.

## Work Items
- [ ] Repository و package manager را آماده کن.
- [ ] نسخه Node/Electron/Playwright را Pin کن.
- [ ] Electron Main، Preload و Renderer را جدا کن.
- [ ] TypeScript strict فعال کن.
- [ ] ESLint و Formatter اضافه کن.
- [ ] Unit Test Runner اضافه کن.
- [ ] Scriptهای `dev`, `build`, `lint`, `typecheck`, `test` بساز.
- [ ] Error handler پایه اضافه کن.
- [ ] App data path را با Electron `app.getPath('userData')` مدیریت کن.
- [ ] هیچ Account/Browser/MCP Feature اضافه نکن.

## Tests First
- [ ] تست مسیر داده.
- [ ] تست validation تنظیمات پایه.
- [ ] تست Error serialization.
- [ ] تست renderer isolation.
- [ ] تست startup/shutdown.

## Acceptance
- برنامه در Development اجرا شود.
- Renderer به Node دسترسی مستقیم نداشته باشد.
- Typecheck/Lint/Test موفق باشند.
- هیچ Secret یا فایل کاربر در Repository نباشد.
