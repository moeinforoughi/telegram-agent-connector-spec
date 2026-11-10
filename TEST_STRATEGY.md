# Test Strategy

## اصل

برای هر Task ابتدا تست طراحی شود؛ سپس Implementation انجام شود؛ بعد از تغییرات تست‌ها اجرا و نتیجه ثبت شود. هیچ تست Fail نباید بدون علت مستند Skip شود.

## Test Layers

### 1. Unit Tests
برای منطق مستقل: Account Registry، State Machine، Path Builder، Profile Lock، Permission Engine، Zod Schemas، Error Mapping، JSON Atomic Write، Audit Redaction، IPC Message Validation، Queue Serialization و Result Size Limiting.

### 2. Integration Tests
با Fixture محلی: Browser Manager روی Local Test Page، Persistent Context و حفظ Storage، Profile Lock، Core Named Pipe، MCP Bridge و Contract، JSON Store و Recovery و Error propagation. هیچ Integration Test نباید به اکانت واقعی Telegram وابسته باشد.

### 3. End-to-end Tests
اجرای Electron در محیط تست، ساخت Account آزمایشی، بازشدن Browser، تشخیص Login State با Fixture، اتصال MCP Client تستی، اجرای Tool و دریافت نتیجه و بسته‌شدن تمیز برنامه.

### 4. Manual Live Tests
فقط با حساب آزمایشی و رضایت کاربر: QR Login، Phone Login، Two-Step Verification، Session persistence، Revoke Session، Telegram Web UI changes و Multi-account واقعی. در CI از شماره تلفن، SMS، QR واقعی یا حساب اصلی استفاده نشود.

## Test-First Workflow
1. Test Caseها را از Acceptance Criteria استخراج کن.
2. تست را بنویس.
3. تست را اجرا و وضعیت اولیه را ثبت کن.
4. کد را پیاده‌سازی کن.
5. تست جدید را اجرا کن.
6. Regression Test را اجرا کن.
7. Typecheck و Lint را اجرا کن.
8. Diff و Log را از نظر Secret بررسی کن.
9. Commit بساز.

## Quality Gates
- TypeScript strict.
- Lint pass.
- Unit tests pass.
- Integration tests pass.
- No leaked secrets.
- No unhandled rejection.
- No stdout noise in MCP.
- No uncontrolled retry.
- No real account dependency in CI.

## Coverage
Coverage هدف اولیه: منطق حساس Account/Policy/IPC حداقل 85% Branch Coverage در صورت عملی بودن؛ سایر منطق‌ها حداقل 75% Line Coverage. Coverage جایگزین کیفیت تست نیست.
