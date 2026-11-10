# TASK 02 — Desktop Shell & Local UI

Priority: P1 | Depends on: TASK 01 | Commit: `feat(desktop): add account management shell`

## Objective
ساخت UI محلی ساده؛ بدون Browser Automation در این فاز.

## Screens
- Dashboard: وضعیت Core، Browser Runtime و MCP.
- Accounts: فهرست اکانت‌ها.
- Add Account: شروع فرآیند اتصال.
- Settings: مسیر داده، اجرای هنگام Login، Log level.
- Agent Integration: وضعیت MCP و راهنمای اتصال.

## Work Items
- [ ] React UI پایه.
- [ ] Preload API محدود.
- [ ] IPC امن و Validate شده.
- [ ] نمایش Empty State و Error State.
- [ ] System Tray و Close-to-tray اختیاری.
- [ ] دکمه Quit واقعی و بستن Browser Contextها.
- [ ] عدم نمایش اطلاعات حساس.

## Tests
- [ ] Renderer نمی‌تواند Node API را فراخوانی کند.
- [ ] IPC فقط Channelهای Allowlist را می‌پذیرد.
- [ ] UI در نبود Core خطای قابل فهم نشان می‌دهد.
- [ ] Close و Quit رفتار متفاوت و مستند دارند.

## Acceptance
UI قابل استفاده و ساده باشد؛ هیچ قابلیت تزئینی یا صفحه غیرضروری اضافه نشود.

## Phase 2 Mapping (2026-11-10)
- این Task با Taskهای ۲.۴ و ۲.۵ پلن Phase 2 پیاده‌سازی می‌شود: Account Metadata، IPC و داشبورد تک‌اکانتی.
- جزئیات: `docs/phase2/PHASE2_PLAN.md`.
- وضعیت: در حال اجرا (Phase 2).
