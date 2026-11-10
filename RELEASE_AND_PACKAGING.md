# Windows Release and Packaging

## Target
- Primary: Windows 11 x64.
- Windows 10 فقط پس از تست جداگانه و تأیید سازگاری.
- Installer نوع Per-user؛ نصب عادی بدون Administrator.
- فرمت اصلی: NSIS Setup.exe.

## Stack
- Electron.
- React + TypeScript.
- Vite یا Electron Vite.
- Playwright با نسخه Pin.
- Chromium سازگار با همان نسخه Playwright.
- MCP TypeScript SDK.
- Zod.
- electron-builder با NSIS.

نسخه دقیق هر Dependency در Phase 0 از مستندات رسمی بررسی و در Lockfile Pin شود. از `latest` در Build/Runtime استفاده نشود.

## Runtime Packaging
- Electron Runtime برای Desktop.
- Node.js مستقل و Pin شده برای MCP STDIO Bridge.
- Node Runtime همراه Installer قرار گیرد.
- MCP Client با مسیر Absolute به Node و MCP Entry متصل شود.
- از `npx` و دانلود Package هنگام اجرای MCP استفاده نشود.

## Browser Packaging
MVP: Chromium سازگار با Playwright همراه Installer بسته‌بندی شود.
- حجم Installer بیشتر می‌شود، اما نصب قابل پیش‌بینی و آفلاین‌تر است.
- Browser Version در Manifest ثبت شود.
- Browser و Playwright Version mismatch باید در Startup Check تشخیص داده شود.
- Browser Binary از منبع رسمی و با Integrity Verification تهیه شود.

## Electron Builder
- NSIS.
- Per-user installation.
- مسیر نصب در Local AppData.
- `asar` برای کد برنامه.
- Browser binaries و Node runtime به‌عنوان `extraResources`.
- مسیر Profile خارج از Installation Directory.
- فایل‌های User Data در Upgrade حذف نشوند.
- Uninstall پیش‌فرض Profile را نگه دارد؛ حذف داده گزینه جداگانه و با تأیید باشد.

## MCP Configuration
- مسیر نصب و Node runtime از مسیر واقعی نصب استخراج شود.
- تنظیمات Client با Backup و Merge امن به‌روزرسانی شود.
- تنظیمات دیگر MCPها حذف یا بازنویسی نشوند.
- Uninstall فقط Entry متعلق به برنامه را حذف کند.
- برای هر Client، مسیر و Schema رسمی همان Client بررسی شود؛ از حدس‌زدن مسیر تنظیمات خودداری شود.

## Updates
در MVP Update دستی/اختیاری. قبل از Upgrade، Profile و Config حفظ شوند. Migration نسخه Profile فقط پس از Backup. Auto-update در فاز بعد و با امضای دیجیتال.

## Signing
برای انتشار عمومی، Code Signing معتبر Windows و Timestamping در نظر گرفته شود. بدون امضا، SmartScreen ممکن است هشدار ناشر ناشناخته نمایش دهد.

## Release Checklist
- [ ] Versionها Pin شده‌اند.
- [ ] Lockfile Commit شده.
- [ ] Chromium سازگار داخل Artifact است.
- [ ] Node runtime MCP داخل Artifact است.
- [ ] Secret/Profiles در Artifact نیست.
- [ ] Installer روی Windows تمیز تست شده.
- [ ] Upgrade تست شده.
- [ ] Uninstall و Data Retention تست شده.
- [ ] MCP config merge و rollback تست شده.
- [ ] Logها Redacted هستند.
- [ ] Release Notes و Known Limitations آماده‌اند.
