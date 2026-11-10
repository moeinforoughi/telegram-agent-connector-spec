# Prompt — اجرای یک Task مشخص

Task ID: `<TASK-ID>`

فقط همین Task را اجرا کن؛ Taskهای بعدی را شروع نکن.

مراحل اجباری:
1. فایل Task و وابستگی‌ها را بخوان.
2. وضعیت Git و تغییرات موجود را بررسی کن.
3. Acceptance Criteria را به Test Case تبدیل کن.
4. تست‌ها را قبل از Implementation بنویس.
5. تست‌های اولیه را اجرا و نتیجه را ثبت کن.
6. کوچک‌ترین Implementation لازم را انجام بده.
7. تست‌های جدید و Regression Test را اجرا کن.
8. Typecheck و Lint را اجرا کن.
9. Security/Secret check انجام بده.
10. مستندات و Checkboxهای Task را به‌روزرسانی کن.
11. Diff را بازبینی کن.
12. فقط در صورت Pass شدن تمام کنترل‌ها Commit بساز.

در پایان گزارش بده: تغییرات، تست‌های اضافه‌شده، تست‌های اجراشده و نتیجه، موارد اجرا نشده و علت، ریسک جدید، Commit Hash و Task بعدی.

اگر Acceptance Criteria قابل تحقق نیست، حدس نزن؛ Blocker را مستند کن و Commit ناقص نساز.
