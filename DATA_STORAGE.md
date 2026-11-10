# Data Storage and Local Paths

## Root Directory

`%LOCALAPPDATA%\\UnofficialTelegramAgentConnector\\`

## ساختار

```text
UnofficialTelegramAgentConnector/
├── config/{accounts.json,policies.json}
├── profiles/<account-id>/chromium-user-data/
├── logs/{app.log,audit.jsonl}
├── cache/
└── backups/
```

## accounts.json
فقط Metadata: `id`, `label`, `profilePath`, `createdAt`, `lastConnectedAt`, `lastKnownStatus`, `enabled`. هیچ Cookie، Token، شماره کامل یا کد ورود ذخیره نشود.

## policies.json
حالت پیش‌فرض فقط عملیات کم‌ریسک؛ پردازش محتوای AI خاموش؛ ارسال پیام خاموش تا زمان Compliance Approval؛ عملیات مخرب نیازمند تأیید.

## Profile
پروفایل Chromium حاوی اطلاعات حساس نشست است:
- در مسیر اختصاصی برنامه باشد.
- با ACL ویندوز فقط برای کاربر فعلی قابل دسترسی باشد.
- در Git، Cloud Sync یا Crash Dump قرار نگیرد.
- در Log هیچ فایل یا محتوای داخلی آن چاپ نشود.
- قبل از Upgrade مهم Playwright/Chromium، Backup محلی اختیاری و امن گرفته شود.
- Profile خام در Backup ابری قرار نگیرد.

## Atomic Writes
برای JSON: فایل موقت در همان پوشه نوشته شود؛ در صورت امکان fsync؛ سپس Rename اتمیک. در خطای Parse، فایل قبلی حفظ و برنامه خطا را گزارش کند.

## Retention
Audit Log فقط Metadata عملیاتی داشته باشد. Logها چرخشی باشند. متن پیام‌ها ذخیره دائمی نشود. حذف Account باید توضیح دهد Profile حاوی نشست است و با تأیید کاربر حذف شود.
