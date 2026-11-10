# Telegram Web Automation Notes

## Supported Interaction Model
- ورود از طریق `https://web.telegram.org/`.
- QR/Phone Login توسط خود کاربر در پنجره قابل مشاهده.
- هیچ credential توسط Connector جمع‌آوری نشود.
- هیچ endpoint خصوصی یا API داخلی استفاده نشود.
- فقط عملیات قابل مشاهده UI.

## Fragility
Telegram Web ممکن است Layout یا Selector را تغییر دهد، Login flow را عوض کند، محدودیت ضدربات یا تأیید اضافی نشان دهد، نشست را منقضی کند یا برخی قابلیت‌ها را در Web Client پشتیبانی نکند.

Adapter باید قابلیت‌ها را در Runtime تشخیص دهد و در نبود قابلیت `UNSUPPORTED_OPERATION` بدهد.

## Safe Failure
اگر صفحه ناشناخته، Dialog جدید، Login دوباره یا Selector نامعتبر دیده شد: عملیات را متوقف کن؛ هیچ کلیک حدسی انجام نده؛ State و Error Code را ثبت کن؛ متن پیام یا داده حساس را Log نکن.

## Scope
MVP روی Account Status، Chat List و عملیات مدیریت چت کم‌ریسز متمرکز است. خواندن و پاسخ‌دادن به محتوای پیام Feature-gated و مشروط به Compliance است.
