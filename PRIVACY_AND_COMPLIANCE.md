# Privacy, Consent and Telegram Compliance

## هشدار ضروری

شرایط رسمی فعلی Telegram در صفحه Content Licensing استفاده از داده‌های پلتفرم برای Scraping، Indexing، Harvesting، Aggregation یا استفاده برای آموزش، Fine-tuning، Validation، Development، Enhancement، Benchmarking یا Deployment مدل‌های AI/ML را محدود می‌کند.

استثنای اعلام‌شده به رضایت صریح، آگاهانه، مثبت و مستمر تمام کاربران مرتبط محدود به محتوای مشخص و همان Chat/Channel/Context وابسته است.

بنابراین:
- Local بودن برنامه به‌تنهایی مجوز پردازش AI ایجاد نمی‌کند.
- استفاده از Playwright به‌جای Telegram API این محدودیت را دور نمی‌زند.
- استفاده از Local LLM نیز نباید به‌عنوان راه دورزدن این شرایط فرض شود.
- خواندن پیام و ارسال آن به LLM برای خلاصه‌سازی، طبقه‌بندی یا تولید پاسخ می‌تواند مشمول این محدودیت باشد.

## منابع رسمی
- Telegram Content Licensing: https://telegram.org/tos/content-licensing
- Telegram API Terms: https://core.telegram.org/api/terms
- Telegram Terms: https://telegram.org/tos

## Product Gate

در MVP:
- `AI_CONTENT_PROCESSING_ENABLED = false`.
- ابزارهای خواندن محتوای پیام و پاسخ‌سازی مبتنی بر متن غیرفعال باشند.
- ابزارهای غیرمحتوایی نیز فقط بعد از بررسی شرایط استفاده و رعایت حریم خصوصی فعال شوند.
- هیچ داده‌ای برای Training، Fine-tuning یا Dataset Collection ذخیره نشود.

## قبل از فعال‌سازی AI Content Processing
1. بررسی حقوقی نسخه جاری شرایط Telegram.
2. تعریف دقیق نوع پردازش و محدوده Context.
3. تعیین تمام کاربران مرتبط با هر Chat/Channel.
4. بررسی امکان اخذ رضایت صریح، آگاهانه، مثبت و مستمر از تمام افراد مرتبط.
5. ثبت Consent Scope، تاریخ، نسخه Policy و روش لغو.
6. توقف پردازش در صورت لغو یا نامشخص بودن رضایت.
7. عدم استفاده از محتوا خارج از Scope تأییدشده.

اگر امکان اخذ و اثبات رضایت لازم وجود ندارد، قابلیت AI روی محتوای آن Chat نباید فعال شود.

## Data Minimization
- فقط داده لازم برای یک درخواست صریح پردازش شود.
- از Background Polling و جمع‌آوری انبوه اجتناب شود.
- محتوای پیام در Log ذخیره نشود.
- خروجی Tool محدود باشد.
- داده‌ها به سرویس خارجی ارسال نشوند مگر اینکه کاربر آگاهانه آن را انتخاب کرده و از نظر شرایط Telegram مجاز باشد.

## Product Disclaimer
برنامه غیررسمی است، به Telegram وابستگی ندارد و از لوگوی رسمی استفاده نمی‌کند. کاربر باید بداند که برنامه رابط وب را خودکار می‌کند و ممکن است با تغییر Telegram Web نیاز به به‌روزرسانی داشته باشد.
