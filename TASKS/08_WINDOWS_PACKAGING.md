# TASK 08 — Windows Installer & Agent Integration

Priority: P1 | Depends on: TASK 01 through TASK 07 | Commit: `build(windows): package installer`

## Work Items
- [ ] electron-builder NSIS.
- [ ] Per-user install.
- [ ] Bundle Node runtime for MCP Bridge.
- [ ] Bundle Playwright-compatible Chromium.
- [ ] Verify browser binary and version.
- [ ] Store profiles outside install directory.
- [ ] Preserve user data during upgrade.
- [ ] Uninstall default keeps data; optional explicit deletion.
- [ ] Add Codex integration after checking current official config schema.
- [ ] Add other MCP Clients only with verified config schema.
- [ ] Merge config safely; backup before modification.
- [ ] Remove only this app's MCP entry on uninstall.
- [ ] Setup version and release metadata.
- [ ] Test paths with spaces and non-ASCII characters.

## Tests
- [ ] Clean Windows 11 VM install.
- [ ] No Node installed.
- [ ] No Docker installed.
- [ ] First launch.
- [ ] Browser availability.
- [ ] MCP bridge launch.
- [ ] Existing MCP config preserved.
- [ ] Upgrade preserves profiles.
- [ ] Uninstall options.
- [ ] App runs without Admin.
- [ ] Windows Defender/SmartScreen behavior documented.

## Acceptance
یک کاربر عادی بتواند فقط با Setup.exe نصب کند و بدون نصب دستی Runtimeها برنامه را اجرا کند.
