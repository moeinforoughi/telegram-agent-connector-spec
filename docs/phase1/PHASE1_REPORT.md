# Phase 1 — Repository Foundation Report

Status: **Complete**  
Date: 2026-11-10  
Task: `TASKS/01_REPO_FOUNDATION.md`

## 1. Scope and Result

Phase 1 delivered the minimum secure desktop foundation for the Unofficial Telegram Agent
Connector. The app starts, renders a React UI, exposes one allowlisted IPC call, uses a
local data directory, and exits cleanly. No Telegram access, browser manager, account,
MCP, or message feature was added.

All Phase 1 acceptance checks pass:

- Development mode starts Vite and Electron.
- Renderer has no direct Node.js or filesystem access.
- TypeScript strict, ESLint, Prettier, unit tests, and Electron E2E tests pass.
- The production build succeeds.
- No secret, profile, log, or build output is committed.

## 2. Repository Structure

```text
src/
  main/
    index.ts              app lifecycle, single-instance lock, data paths, window creation
    dev-server.ts         localhost-only dev server URL validation
    ipc-result.ts         IPC result envelope and sanitized error logging
    ipc-router.ts         allowlisted IPC handler, sender check, error envelope
    paths.ts              user-data root and data directory layout
    trusted-sender.ts     pure sender-validation helper
    window-manager.ts     BrowserWindow creation, permission denial, navigation policy
    window-options.ts     pure secure webPreferences factory
  preload/
    index.ts              contextBridge API: getAppInfo only
  renderer/
    index.html
    src/
      App.tsx             minimal Phase 1 status screen
      main.tsx
      styles.css
      env.d.ts
      vite-env.d.ts
  shared/
    constants.ts          product name and app ID
    errors.ts             error codes, AppError, sanitized IPC serialization
    ipc.ts                channels, allowlist, result types, preload API type
    types.ts              AppInfo and DataPaths
tests/
  unit/
    dev-server.test.ts
    errors.test.ts
    ipc-result.test.ts
    ipc-router.test.ts
    ipc.test.ts
    paths.test.ts
    window-manager.test.ts
    window-options.test.ts
  e2e/
    app.test.ts
electron.vite.config.mts
vitest.config.mts
eslint.config.mjs
tsconfig.json
package.json
package-lock.json
```

`spike/` and all Phase 0 evidence remain untouched. The Phase 0 test profile was deleted
after evidence collection; the JSONL evidence log is retained.

## 3. Dependencies

All versions are exact (`.npmrc` has `save-exact=true`), and `package-lock.json` is
committed.

### Runtime dependencies

| Package | Version | Reason |
|---|---:|---|
| `react` | 19.3.1 | Renderer UI |
| `react-dom` | 19.3.1 | Renderer DOM runtime |

### Development dependencies

| Package | Version | Reason |
|---|---:|---|
| `electron` | 45.2.3 | Desktop shell and Main/Preload runtime |
| `electron-vite` | 6.0.0 | Dev server and Main/Preload/Renderer builds |
| `vite` | 8.3.7 | Renderer bundler; peer of electron-vite and Vitest |
| `@vitejs/plugin-react` | 6.3.0 | React JSX and development refresh |
| `typescript` | 5.9.3 | Strict type checking |
| `@types/node` | 24.19.2 | Node types matching Electron 45's embedded Node 24 |
| `@types/react` | 19.3.0 | React types |
| `@types/react-dom` | 19.3.0 | React DOM types |
| `eslint` | 10.14.0 | Linting |
| `@eslint/js` | 10.0.1 | ESLint recommended rules |
| `typescript-eslint` | 8.72.2 | TypeScript rules |
| `eslint-config-prettier` | 10.1.8 | Disable formatting conflicts |
| `globals` | 17.14.0 | Node/browser global definitions |
| `prettier` | 3.9.10 | Formatting |
| `vitest` | 5.1.0 | Unit and E2E test runner |
| `playwright` | 1.65.0 | Electron E2E via `_electron` (dev-only in Phase 1) |

### Deliberately not added

- `zod`: no user-facing settings schema exists yet; add when settings are implemented.
- `@modelcontextprotocol/sdk`: MCP is Phase 5.
- Playwright as a runtime dependency: Browser Manager is Phase 2. It remains dev-only for
  the Electron E2E suite in Phase 1.
- `electron-builder`: packaging is a later phase.
- SQLite, Docker, auto-update, proxy manager: outside the MVP foundation.

## 4. Runtime Versions

| Runtime | Version | Use |
|---|---:|---|
| External Node.js | 26.13.0 LTS | npm, Vite, TypeScript, Vitest, build tooling |
| Electron | 45.2.3 | Desktop app |
| Electron embedded Node.js | 24.22.2 | Electron Main and Preload |
| Electron Chromium | 156.0.8078.80 | App renderer only |
| Electron V8 | 15.6.75.27-electron.0 | Electron runtime |
| Playwright | 1.65.0 | E2E driver; Phase 2 browser automation |
| Chrome for Testing | 158.0.8127.18 (rev 1254) | Playwright/Phase 0 browser; not Electron's Chromium |

The two Chromium versions are separate by design:

- Electron's Chromium renders the connector UI.
- Playwright's pinned Chrome for Testing is the browser used by the Telegram Browser
  Manager in Phase 2. They must not be treated as the same runtime.

Likewise, Electron Main uses Electron's embedded Node.js, not the external Node.js used
for build and tests. MCP Bridge will receive its own pinned Node runtime at packaging time.

## 5. Architecture

### Process separation

- **Main** owns app lifecycle, the single-instance lock, window creation, data paths, IPC
  registration, and error handling.
- **Preload** uses `contextBridge` to expose exactly one function: `getAppInfo()`. It does
  not expose `ipcRenderer`, a generic `invoke`, filesystem access, or Node globals.
- **Renderer** is a React UI with no direct Node.js or filesystem access. It reads only
  the allowlisted API response.

### IPC

- One allowlisted channel: `app:get-info`.
- No generic IPC bridge exists.
- The handler checks that the sender is the app window's main frame and matches the
  expected `webContents` ID.
- Responses use a result envelope:
  - `{ ok: true, data }`
  - `{ ok: false, error: { code, message, retryable } }`
- Known `AppError` values preserve their code and message. Unknown errors are sanitized to
  `INTERNAL_ERROR` / `Unexpected error`; the real error is not returned to the renderer.
- The error-code list matches `ARCHITECTURE.md`.

### Data paths

The app sets `userData` before `app.whenReady()`:

```text
%LOCALAPPDATA%\UnofficialTelegramAgentConnector\
  config\
  profiles\
  logs\
  cache\
  backups\
```

`CONNECTOR_USER_DATA_DIR` is an absolute-path test/dev override. It is honored only when
`app.isPackaged` is false; a packaged app always uses the default root. Blank or relative
overrides are ignored. Phase 1 creates the empty directories; it does not create profiles
or store Telegram data.

The renderer receives only `appName`, `appVersion`, and `platform`; local paths are not
sent over IPC.

### Electron security

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `webviewTag: false`
- `allowRunningInsecureContent: false`
- All permission checks and requests are denied.
- Subframe navigation and redirects to a different URL are blocked at runtime, and new
  windows are denied.
- The dev server URL is read only when the app is unpackaged and must be `localhost`,
  `127.0.0.1`, or `[::1]`; anything else is ignored and the local file is loaded.
- A single-instance lock prevents two Core instances.
- A strict Content Security Policy is injected into the production HTML:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self'`
  - `connect-src 'none'`
  - `img-src 'self' data:`
  - `object-src 'none'`
  - `base-uri 'none'`
  - `form-action 'none'`
- `frame-ancestors` is not used in the meta tag because browsers ignore it there; frame
  embedding is not reachable because the app is not served over HTTP.
- Development CSP is looser only for Vite's React refresh preamble and HMR socket. It is
  injected at build time and never shipped in the production build.
- The renderer bundle is minified and targets Electron 45's Chromium 156.

### Lifecycle and errors

- `app.requestSingleInstanceLock()` prevents duplicate app instances.
- `window-all-closed` quits on Windows.
- `render-process-gone` is logged without page content.
- Uncaught exceptions and unhandled rejections are logged by name; the app exits on an
  uncaught exception.
- Renderer load failure logs the error name and exits.
- No message content, credentials, cookies, or profile data are logged.

## 6. Tests

### Unit tests — 28 passed

| File | Coverage |
|---|---|
| `tests/unit/paths.test.ts` | LOCALAPPDATA default, absolute/relative/blank override validation, packaged override disable, path layout, directory creation |
| `tests/unit/errors.test.ts` | AppError fields, IPC serialization, unknown-error redaction, non-Error throws |
| `tests/unit/ipc.test.ts` | Channel allowlist, duplicate prevention, trusted-sender matrix |
| `tests/unit/ipc-router.test.ts` | Handler registration, sender rejection, success/error envelope, no duplicate channel registration |
| `tests/unit/ipc-result.test.ts` | Success and failure envelopes, sanitized logging of unknown errors |
| `tests/unit/dev-server.test.ts` | Accepts localhost/127.0.0.1/[::1]; rejects remote, malformed, and empty URLs |
| `tests/unit/window-manager.test.ts` | Secure window construction, permission denial, window-open denial, navigation guards, dev URL gating |
| `tests/unit/window-options.test.ts` | contextIsolation, nodeIntegration, sandbox, webSecurity, webviewTag, insecure content |

### Electron E2E — 6 passed

| Test | What it proves |
|---|---|
| Renderer shell | Window title and H1 load from the production build |
| Renderer hardening | `require`, `process`, `Buffer`, and `module` are undefined; `window.api` has only `getAppInfo`; no `ipcRenderer` |
| IPC and data path | `getAppInfo` returns the allowlisted result without local paths; test data root matches; all data directories exist |
| Navigation policy | `window.open` creates no window; remote `location.href` navigation is blocked |
| Production CSP | Strict policy is present, contains no `'unsafe-inline'`, and omits `frame-ancestors` |
| Shutdown | Main process exits after its last window closes |

The test files were written before the implementation. The unit suite was executed first
and failed on missing modules (RED), then passed after the minimal implementation
(GREEN). The E2E suite was written before implementation and first executed against the
built shell; it drives the real Electron app, not a mock.

### Commands

```text
npm run test:unit   28 passed
npm run test:e2e     6 passed
npm run typecheck   passed
npm run lint        passed
npm run format:check passed
npm run check       passed (typecheck + lint + format + unit + E2E)
```

## 7. Build and Development

`npm run build` succeeds:

```text
out/main/index.js                  8.37 kB
out/preload/index.js               0.28 kB
out/renderer/index.html            0.69 kB
out/renderer/assets/index.css      1.05 kB
out/renderer/assets/index.js     220.56 kB
```

Development mode was verified separately:

- `npm run dev` built Main and Preload, started Vite on `localhost:5173`, and started
  Electron.
- `http://localhost:5173/` returned HTTP 200.
- The development page contained the development CSP.
- No Electron or Node process from the project remained after shutdown.

`npm run start` uses `electron-vite preview` against the built `out/` directory.

## 8. Compatibility Check

Verified before finalizing the dependency set:

- Vite 8.3.7 requires Node `^20.19.0 || >=22.12.0`; external Node 26.13.0 fits.
- electron-vite 6.0.0 supports Vite 6.4.1, 7.x, and 8.x; Vite 8.3.7 fits.
- `@vitejs/plugin-react` 6.3.0 requires Vite `^8.0.0`; fits.
- Vitest 5.1.0 supports Vite 6.4.1/7/8 and Node `^22.12 || ^24 || >=26`; fits.
- ESLint 10.14.0 is supported by `typescript-eslint` 8.72.2 and `@eslint/js` 10.0.1.
- `typescript-eslint` 8.72.2 supports TypeScript `>=4.8.4 <6.1`; TypeScript 5.9.3 fits.
- `react-dom` 19.3.1 requires React `^19.3.1`; exact match.
- Electron 45.2.3 requires Node `>=22.12.0` for tooling; external Node 26.13.0 fits.
- Playwright 1.65.0 does not need its own browser download for Electron E2E; Electron is
  the browser under test.

## 9. Security and Git Hygiene

- No Telegram credentials, QR payload, session data, phone number, 2FA password, or proxy
  credentials were used or committed.
- No profile directory or runtime log is tracked.
- `node_modules/`, `out/`, `coverage/`, `*.log`, profiles, and secret file extensions are
  ignored.
- `.npmrc` pins exact installs and enforces the Node engine range.
- No proxy IP or port is hardcoded in application code.
- Phase 1 does not attempt Telegram connectivity. D-006 proxy behavior remains a Phase 2
  implementation item.

## 10. Limitations and Deferred Work

- Electron 45 no longer exposes `webContents.getLastWebPreferences()`. Security options
  are verified in a unit test, and actual renderer isolation is verified at runtime in
  Electron E2E.
- E2E opens a real Electron window; it is not headless.
- Tests are written for Windows 11 x64. The `LOCALAPPDATA` path behavior is Windows-specific.
- No installer, code signing, auto-update, or release manifest yet.
- No Browser Manager, Telegram account, profile locking, selector adapter, MCP server,
  MCP bridge, message tools, SQLite, or proxy manager.
- The Electron binary download during `npm install` may need a proxy or mirror in
  restricted networks. This is a build-environment concern; no proxy is embedded in the
  app.

## 11. Task 01 Status

`TASKS/01_REPO_FOUNDATION.md` is complete: all work items, tests-first items, and acceptance
criteria are checked, with the result recorded in that file.

## 12. Next Step

Phase 2 — Browser Manager — only after explicit user approval.

The first Phase 2 item must implement D-006:

1. Prove whether Chromium inherits the OS/VPN proxy path.
2. Keep System Proxy First.
3. Add a manual HTTP/SOCKS5 fallback only if needed.
4. Never hardcode a proxy IP/port, scan system ports, change OS proxy settings, or log
   proxy credentials.
5. Show a clear error when Telegram Web cannot be reached.

No Phase 2 work should begin until the user approves this report.

## 13. Commits

- `8e25b57` — `docs(spike): document 2FA and proxy behavior`
- Phase 1 commit — `chore: initialize electron repository`
