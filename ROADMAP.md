# Roadmap

## Phase 0 — Feasibility & Technical Spike
اثبات اینکه روش بدون Telegram API credentials واقعاً کار می‌کند. خروجی: PoC محدود، گزارش سازگاری و تصمیم Go/No-Go.

## Phase 1 — Repository Foundation
اسکلت Electron/TypeScript، کیفیت کد و تست پایه. خروجی: برنامه خالی قابل اجرا و Pipeline تست.

## Phase 2 — Browser & Login
اتصال یک اکانت، QR Login و Persistent Profile. خروجی: ورود واقعی با حساب آزمایشی و حفظ Session پس از Restart.
**وضعیت: COMPLETE FOR MVP (2026-11-10؛ deferred verifications پذیرفته شد).**

## Phase 3 — Multi-account
مدیریت چند Profile مستقل. خروجی: حداقل سه اکانت بدون تداخل.
**وضعیت: COMPLETE FOR MVP (2026-11-10؛ دو Account زنده PASS، Account سوم live Tested نشد).**

## Phase 4 — Safe Telegram Web Operations
عملیات UI کم‌ریسک و غیرمحتوایی. خروجی: وضعیت اکانت، فهرست محدود چت‌ها و عملیات آرشیو/Pin/Mute در صورت پشتیبانی.
Tasks 1–3 deliver the selector audit, per-account read adapter, and agent-ready
read interface. Task 4 is the separately approved live validation checkpoint.
See `docs/phase4/PHASE4_PLAN.md`.

## Phase 5 — MCP Bridge
MCP Server is outside the Phase 4 desktop MVP and reuses TelegramService in
Phase 5, after separate approval.
اتصال MCP Client به Core محلی. خروجی: Toolهای کم‌تعداد، خروجی محدود و STDIO پایدار.

## Phase 6 — Desktop UX & Windows Installer
نصب و اتصال آسان. خروجی: Setup.exe، Tray، First-run Wizard و اتصال MCP.

## Phase 7 — Hardening & Release
امنیت، پایداری، تست Windows تمیز و Release.

## Phase 8 — Optional Features

Post-MVP candidates include settings/privacy automation, advanced contact
management, full group and channel administration, and message editing/deletion.
Generic automation, full or periodic UI scans, dynamic workflow builders, full
Bot API parity and bulk messaging are excluded from the product roadmap.
فقط بعد از تأیید MVP: ابزارهای بیشتر مدیریت چت، Policy پیشرفته، Auto-start، Auto-update، Windows 10/macOS/Linux. AI Content Processing فقط در صورت حل کامل Compliance/Consent.
