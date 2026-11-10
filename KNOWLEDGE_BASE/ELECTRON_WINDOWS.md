# Electron & Windows Packaging Notes

## Security
- Context Isolation فعال.
- Node Integration در Renderer خاموش.
- Sandbox فعال تا حد سازگاری.
- Preload API کوچک و Allowlist.
- IPC Sender بررسی شود.
- ورودی IPC در Main دوباره Validate شود.
- CSP مناسب برای Renderer.
- Remote Content غیرقابل اعتماد داخل Renderer اصلی بارگذاری نشود.

## Process Model
- Main Process مالک Core و Browser Manager.
- Renderer فقط UI.
- MCP Bridge Process مستقل.
- Node runtime مستقل برای اجرای Bridge در کنار Installer بسته‌بندی شود.

## Packaging
- NSIS Per-user Installer.
- User Data خارج از Installation Directory.
- Browser Runtime و Node runtime در Resources.
- Profile در Local AppData.
- Upgrade نباید Profile را حذف کند.
- Uninstall باید رفتار حفظ/حذف داده را شفاف کند.

## References
https://www.electronjs.org/docs/latest/tutorial/security
https://www.electronjs.org/docs/latest/tutorial/process-model
https://www.electron.build/
