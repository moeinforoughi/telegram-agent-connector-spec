# MCP Contract

## هدف

ارائه چند Tool سطح‌بالا و مشخص؛ نه کنترل عمومی Browser.

## Transport
- STDIO بین Agent Host و MCP Bridge.
- Bridge با Node.js همراه برنامه اجرا می‌شود.
- Bridge به Core از طریق Windows Named Pipe متصل می‌شود.
- stdout فقط برای پروتکل MCP.
- Log فقط به stderr.
- هیچ HTTP Port عمومی باز نشود.

## ابزارهای MVP

### `telegram_accounts_list`
بدون ورودی یا فیلتر اختیاری. خروجی: `account_id`, `label`, `status`, `last_connected_at`. محتوا و Session برنگرداند.

### `telegram_account_status`
ورودی: `account_id`. خروجی: وضعیت، Browser state، نیاز به Login، خطای خلاصه.

### `telegram_account_connect`
ورودی: `account_id` یا `label`. عملکرد: درخواست بازکردن پنجره قابل مشاهده Telegram Web. خروجی: `login_window_opened`, `next_step`. این Tool نباید شماره، کد ورود یا رمز را بگیرد.

### `telegram_chats_list`
ورودی: `account_id` اجباری، `limit` پیش‌فرض 10 و حداکثر 30، `cursor` اختیاری، `kind` اختیاری. خروجی: شناسه داخلی چت، عنوان قابل نمایش، نوع و متادیتای محدود. محتوای پیام‌ها برنگردد.

### `telegram_chat_action`
ورودی: `account_id`, `chat_id`, `action` از میان `archive | unarchive | mute | unmute | pin | unpin`. فقط عملیات UI که در نسخه Telegram Web پشتیبانی و تست شده‌اند فعال شوند.

### `telegram_health`
خروجی: نسخه Connector، وضعیت Core، Browser availability، MCP status و قابلیت‌های فعال. هیچ Secret یا اطلاعات شخصی برنگرداند.

## ابزارهای مشروط / Feature-gated

این ابزارها تا زمان بررسی Telegram Content Licensing و رضایت لازم غیرفعال هستند:
- `telegram_messages_read`
- `telegram_message_send`
- `telegram_message_reply`
- `telegram_message_edit`
- `telegram_message_delete`
- هر قابلیت AI برای خلاصه‌سازی، طبقه‌بندی یا تولید پاسخ بر اساس متن چت.

فعال‌سازی صرفاً با تغییر یک Environment Variable یا Prompt مجاز نیست. باید Compliance Review، Policy و رضایت معتبر در سطح Context پیاده‌سازی و مستند شود.

## Tool Output Design
- خروجی پیش‌فرض کوتاه باشد.
- متن پیام، DOM، Screenshot، Cookie یا Local Storage در خروجی ابزار قرار نگیرد.
- `limit` و سقف طول خروجی اجباری باشد.
- خطاها دارای `code`, `message`, `retryable`, `correlation_id` باشند.
- اطلاعاتی که برای ادامه کار لازم نیست به مدل ارسال نشود.

## خطاهای استاندارد
`CONNECTOR_NOT_RUNNING`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_CONNECTED`, `LOGIN_REQUIRED`, `PROFILE_LOCKED`, `UNSUPPORTED_OPERATION`, `PERMISSION_DENIED`, `COMPLIANCE_GATE_BLOCKED`, `TELEGRAM_UI_CHANGED`, `RATE_LIMIT_OR_FLOOD_WAIT`, `OUTCOME_UNKNOWN`, `TIMEOUT`, `INTERNAL_ERROR`.

## Idempotency
برای عملیات تغییر وضعیت چت، قبل و بعد از کلیک وضعیت UI بررسی شود. برای ارسال پیام، اگر نتیجه نامشخص شد، Retry خودکار ممنوع است؛ ابتدا باید وضعیت پیام بررسی شود. در صورت عدم امکان اثبات، `OUTCOME_UNKNOWN` برگردانده شود.

## Versioning
- نسخه قرارداد داخلی Pipe مستقل از نسخه MCP باشد.
- Tool nameها تا حد امکان پایدار بمانند.
- تغییر Schema باید تست Contract داشته باشد.
- Toolهای قدیمی بدون Deprecation حذف نشوند.
