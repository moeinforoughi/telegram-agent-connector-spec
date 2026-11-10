# TASK 03 — Browser, QR Login & Session Persistence

Priority: P0 | Depends on: TASK 00, TASK 01, TASK 02 | Commit: `feat(browser): add persistent Telegram Web account login`

## Objective
اتصال یک اکانت واقعی با Browser قابل مشاهده و حفظ Session.

## Work Items
- [ ] Browser Manager با Playwright.
- [ ] Profile Directory مستقل.
- [ ] Persistent Context.
- [ ] اجرای Headed Chromium.
- [ ] Navigate به Telegram Web.
- [ ] Login State Detector.
- [ ] State Machine.
- [ ] Login UI instructions.
- [ ] عدم دریافت شماره/کد/رمز توسط MCP.
- [ ] بستن امن Browser.
- [ ] Profile Lock.
- [ ] Timeout و Error Mapping.
- [ ] Selectorها در یک لایه مرکزی.

## Tests First
- [ ] Browser launch failure.
- [ ] Profile path creation.
- [ ] Duplicate profile lock.
- [ ] Persistent storage on local fixture.
- [ ] Browser crash.
- [ ] Telegram Web unavailable.
- [ ] Login state transition.
- [ ] No secrets in logs.

## Manual Tests
- [ ] QR Login با حساب آزمایشی.
- [ ] Phone Login در خود Telegram Web.
- [ ] Two-Step Verification در خود Telegram Web.
- [ ] Restart برنامه و بازگشت نشست.
- [ ] Logout/Revoke از موبایل و تشخیص نیاز به Login.

## Acceptance
- یک اکانت متصل شود.
- Session بعد از Restart حفظ شود، در صورت معتبر بودن.
- برنامه هیچ کد یا رمز ورود را نبیند یا ذخیره نکند.
- Browser profile مستقل و قفل‌شده باشد.
