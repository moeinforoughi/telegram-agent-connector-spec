# Target Source Tree

این ساختار هدف است؛ لازم نیست تمام فایل‌ها از روز اول ساخته شوند. هر Task فقط فایل‌های موردنیاز خود را اضافه کند.

```text
telegram-agent-connector/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── electron-builder.yml
├── .gitignore
├── .editorconfig
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── app-lifecycle.ts
│   │   ├── window-manager.ts
│   │   ├── tray.ts
│   │   ├── ipc/{ipc-server.ts,protocol.ts,auth.ts}
│   │   └── security/path-policy.ts
│   ├── preload/index.ts
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/{App.tsx,pages/,components/,styles/}
│   ├── core/
│   │   ├── connector-core.ts
│   │   ├── accounts/{account-registry.ts,account-service.ts,account-state.ts,profile-lock.ts}
│   │   ├── browser/{browser-manager.ts,browser-factory.ts,profile-paths.ts}
│   │   ├── telegram/{telegram-web-adapter.ts,login-detector.ts,navigation.ts,chat-operations.ts,selectors/}
│   │   ├── tasks/{account-queue.ts,operation-result.ts}
│   │   ├── policy/{permission-engine.ts,compliance-gate.ts}
│   │   ├── storage/{json-store.ts,audit-log.ts}
│   │   └── errors/error-codes.ts
│   ├── mcp/{server.ts,bridge-client.ts,tools/,schemas/}
│   └── shared/{types.ts,constants.ts,validation.ts}
├── resources/{node/win32-x64/node.exe,playwright-browsers/chromium/}
├── scripts/{verify-env.ts,prepare-browser.ts,package-windows.ts,verify-artifact.ts}
├── tests/{unit/,integration/,e2e/,fixtures/,manual/}
└── docs/{architecture/,decisions/,operations/,release/}
```

## قواعد ساختار
- این راهنمای ساختار است؛ برای هر فایل دلیل واقعی داشته باش.
- `renderer` نباید به `core` یا Node API دسترسی مستقیم داشته باشد.
- `telegram` نباید به UI یا MCP وابسته باشد.
- `mcp` فقط از قراردادهای Core استفاده کند.
- `shared` محل انباشتن کدهای نامرتبط نشود.
- فایل‌های `resources/playwright-browsers` و `resources/node` در Git نگهداری نشوند؛ در Build Pipeline تهیه و Verify شوند.
