# MCP Notes

## STDIO
برای MCP Client محلی، STDIO گزینه ساده و متداول است:
- Client، Bridge Process را اجرا می‌کند.
- Bridge پیام‌های MCP را از stdin می‌خواند.
- پاسخ‌های MCP را روی stdout می‌نویسد.
- Log فقط stderr.

## Bridge
Bridge Browser را اجرا نمی‌کند. فقط به Core موجود از طریق Named Pipe وصل می‌شود.
اگر Core فعال نیست، خطای `CONNECTOR_NOT_RUNNING` و راهنمای بازکردن Desktop App برگردانده شود. در MVP Core از داخل MCP Bridge به‌صورت خودکار ساخته نشود.

## Tool Design
- Toolهای سطح‌بالا و کم‌تعداد.
- ورودی کوچک و Validate شده.
- Account ID اجباری برای عملیات اکانت.
- خروجی محدود و خلاصه.
- هیچ Browser DOM یا Screenshot کامل.
- هیچ `browser_run_code`, shell یا eval عمومی.

## Official References
https://modelcontextprotocol.io/docs
https://github.com/modelcontextprotocol/typescript-sdk
