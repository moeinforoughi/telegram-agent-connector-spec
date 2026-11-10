# TASK 06 — MCP Server & Local Bridge

Priority: P1 | Depends on: TASK 01, TASK 02, TASK 04, TASK 05 | Commit: `feat(mcp): add local Telegram MCP tools`

## Objective
ارائه Toolهای سطح‌بالا به Agent بدون افشای کنترل عمومی Browser.

## Work Items
- [ ] MCP TypeScript SDK.
- [ ] STDIO Server.
- [ ] Bridge Client به Named Pipe.
- [ ] IPC Protocol version.
- [ ] Request ID و Timeout.
- [ ] Zod Tool Schemas.
- [ ] Tool Allowlist.
- [ ] Error mapping.
- [ ] stdout فقط MCP؛ Log به stderr.
- [ ] Node runtime همراه Installer.
- [ ] Toolهای Account/Status/Chat List/Chat Action/Health.
- [ ] Feature Gate برای Content Tools.

## Tests
- [ ] MCP handshake.
- [ ] Tool discovery.
- [ ] Tool schema validation.
- [ ] Core unavailable.
- [ ] Pipe auth/ACL.
- [ ] Concurrent client requests.
- [ ] stdout cleanliness.
- [ ] oversized payload rejection.
- [ ] output limit.
- [ ] content tool blocked when compliance gate off.

## Acceptance
حداقل یک MCP Client محلی بتواند ابزارهای مجاز را اجرا کند. اگر Desktop Core خاموش است، خطای قابل فهم برگردد.
