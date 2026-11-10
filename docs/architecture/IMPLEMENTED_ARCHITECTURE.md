# Implemented Architecture — Phase 0 to Phase 2 Task 8

Status: current implementation, reconciled against the code and tests in the
repository. Phase 2 live verification is still pending; see
`docs/phase2/PHASE2_REPORT.md`.

Scope: Phase 0 feasibility spike, Phase 1 Electron foundation, Phase 2 Tasks 1–8.
This document records what is **actually implemented**, not only the target
design in `ARCHITECTURE.md`. Where the implementation differs, the difference is
listed in §9 with its reason and limits.

Evidence base: commits `619c095` (Phase 1), `22789a8`–`cce43eb` (Phase 2 Tasks
1–6), `07f20d9` (Task 7), and the automated suites listed in §8.

## 1. Runtime topology

| Runtime | Version | Role |
|---|---|---|
| Electron Main | Electron 45.2.3, embedded Node 24.22.2 | Owns Core, Browser Manager, account state, IPC handlers |
| Preload | Electron 45.2.3 (sandboxed) | Exposes the validated `window.api` bridge only |
| Renderer | Chromium 156.0.8078.80 (inside Electron) | React 19 UI; no Node, no filesystem, no Playwright |
| Telegram browser | Chrome for Testing 158.0.8127.18 (revision 1254) | Headed Playwright persistent context for Telegram Web |
| Test/tooling | Node.js 26.13.0 | Vite, Vitest, Playwright test driver, ESLint, Prettier |

The two Chromium instances are different products and must not be confused:
Electron's embedded Chromium renders the connector UI; Playwright's pinned
Chrome for Testing renders Telegram Web.

## 2. Component map

| Area | Files |
|---|---|
| App lifecycle | `src/main/index.ts` |
| Window and security | `src/main/window-manager.ts`, `src/main/window-options.ts`, `electron.vite.config.mts` (CSP) |
| Local IPC | `src/main/ipc-router.ts`, `src/main/trusted-sender.ts`, `src/main/ipc-result.ts`, `src/shared/ipc.ts`, `src/preload/index.ts` |
| Data paths | `src/main/paths.ts`, `src/shared/constants.ts` |
| Browser | `src/core/browser/browser-manager.ts`, `browser-factory.ts`, `browser-types.ts`, `profile-paths.ts`, `profile-lock.ts` |
| Telegram | `src/core/telegram/selectors/selector-map.ts`, `login-detector.ts`, `login-monitor.ts`, `navigation.ts`, `telegram-types.ts` |
| Account | `src/core/account/account-store.ts`, `src/main/account-controller.ts`, `src/shared/account.ts` |
| Network | `src/core/network/proxy-resolver.ts`, `windows-proxy.ts` |
| Renderer | `src/renderer/src/App.tsx`, `styles.css` |

## 3. Electron architecture

### Main process

`src/main/index.ts`:

- Creates the single app instance, sets the app name and AppUserModelID, and
  refuses a second instance (`requestSingleInstanceLock`); a second launch
  focuses the existing window.
- Resolves the data root before any window exists: `LOCALAPPDATA` +
  `UnofficialTelegramAgentConnector`, or `app.getPath("userData")` as fallback.
  `CONNECTOR_USER_DATA_DIR` can override it only when the app is not packaged.
  `config`, `profiles`, `logs`, `cache`, and `backups` are created eagerly.
- On `whenReady`, creates one window, creates `AccountController` +
  `BrowserManager` + `AccountStore`, registers the allowlisted IPC handlers,
  then loads the renderer.
- `window-all-closed` quits the app. `before-quit` prevents quit while a browser
  is running, awaits `controller.stop()`, then quits once (`quitReady` guard).
- `uncaughtException` logs the error name and calls `app.exit(1)`;
  `unhandledRejection` logs the error name.
- `render-process-gone` is logged.

### Preload and renderer isolation

`src/main/window-options.ts` sets `contextIsolation: true`, `sandbox: true`,
`nodeIntegration: false`, `webSecurity: true`, `webviewTag: false`,
`allowRunningInsecureContent: false`, `spellcheck: false`.

`src/preload/index.ts` exposes exactly one bridge, `window.api`, with six invoke
functions and one subscription:

`getAppInfo`, `getAccount`, `startAccount`, `stopAccount`, `openTelegram`,
`removeAccount`, `onAccountStatus`.

No `ipcRenderer`, `require`, `process`, `Buffer`, or module loader is exposed.
The E2E suite asserts this at runtime.

`src/main/window-manager.ts` denies new windows, denies all permission checks
and requests, and cancels any navigation whose target differs from the current
URL (`will-frame-navigate`, `will-redirect`).

### Content Security Policy

`electron.vite.config.mts` injects a CSP meta tag at build time:

- Production: `default-src 'self'; script-src 'self'; style-src 'self';
  connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none';
  form-action 'none'`.
- Dev: allows inline script/style and localhost HMR websocket only.
- The E2E suite asserts the production policy and the absence of
  `unsafe-inline`, `frame-ancestors`, and external connect sources.

### IPC contract

`src/shared/ipc.ts` defines the allowlist:

| Channel | Payload | Result |
|---|---|---|
| `app:get-info` | none | `AppInfo` |
| `account:get` | none | `AccountView` |
| `account:start` | none | `AccountView` |
| `account:stop` | none | `AccountView` |
| `account:open` | none | `AccountView` |
| `account:remove` | `{ deleteProfile: boolean }` | `AccountView` |

Event: `account:status` (Main → Renderer) carries an `AccountView`.

`src/main/ipc-router.ts` registers only allowlisted channels, removes stale
handlers first, validates the sender with `isTrustedSender` (sender webContents
id, main frame, and exact current URL), dispatches per channel, validates the
`account:remove` payload as a boolean, and wraps every result in
`{ ok: true, data } | { ok: false, error }`. Failures are logged by error code
only; unknown errors become `INTERNAL_ERROR` with a generic message.

No channel accepts a path, profile directory, shell command, URL, or arbitrary
JavaScript. The renderer cannot ask Main to run `evaluate` or open a URL.

## 4. Browser architecture

### Launch

`createPlaywrightLauncher()` in `src/core/browser/browser-factory.ts` lazily
imports `playwright` and calls:

```ts
chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
  acceptDownloads: false,
  timeout: 30_000,
  args: ["--no-first-run", "--no-default-browser-check"],
  ...(proxy ? { proxy } : {}),
});
```

`playwright` is a **runtime dependency** so electron-vite externalizes it instead
of bundling it. The import is lazy so app startup and unit tests do not load the
browser stack.

### Profile layout

```
%LOCALAPPDATA%\UnofficialTelegramAgentConnector\
  config\accounts.json
  profiles\<accountId>\
    chromium-user-data\      ← Playwright user data directory
    profile.lock             ← app-level lock JSON { pid, createdAt }
  logs\ cache\ backups\
```

`profile-paths.ts` validates the account id with `^[a-z0-9][a-z0-9-]{0,63}$`
and derives `<profilesRoot>/<id>/chromium-user-data`. No profile path is ever
sent to the renderer.

### Locking

`profile-lock.ts` implements an app-level lock in addition to Chromium's own
singleton lock:

- `acquireProfileLock` creates the file with the `wx` flag.
- If it exists, the JSON is parsed. A lock whose PID is alive
  (`process.kill(pid, 0)`, including `EPERM`) raises `PROFILE_LOCKED`.
- A stale or malformed lock is removed and recreated.
- `releaseProfileLock` only removes a lock owned by the current PID.
- Recovery never deletes the profile directory.

### Manager

`BrowserManager` owns at most one session (one context, one page, one lock):

- `launch` refuses a second session in the same process, acquires the lock,
  calls the launcher, takes the first page or opens one, subscribes to the
  context `close` event, and logs page crashes.
- Launcher failures release the lock and map to `BROWSER_LAUNCH_FAILED`; a
  `PROFILE_LOCKED` error propagates unchanged.
- `close` clears the session first, closes the context, and always releases the
  lock.
- External context close releases the lock and calls the `onClosed` hook, which
  the controller turns into a `BROWSER_CLOSED` error view.

### Lifecycle

Browsers are lazy: nothing starts until the user connects. One account is
supported in Phase 2. Operations are serialized by `BrowserManager.running` and
by `AccountController.start()` returning the in-flight promise. A browser is
closed on Disconnect, on Remove Account, on window close, and on app quit.

## 5. Telegram integration

### Target and navigation

`navigation.ts` pins `https://web.telegram.org/k/` (WebZ; ADR-011).
`isTelegramWebUrl` requires HTTPS, host `web.telegram.org`, and pathname `/k`,
`/k/`, or under `/k/`. `openTelegram` waits for `domcontentloaded` with a 60 s
timeout, maps navigation failure to `NETWORK_ERROR`, and rejects an unexpected
final URL with `TELEGRAM_UI_CHANGED`.

### Selectors

All selectors live in `selector-map.ts` (`authPage`, `qr`, `chatList`,
`chatItems`). They are ordered fallbacks from Phase 0. No selector exists
anywhere else in product code.

### Login detection

`detectLoginState` uses **visibility**, not DOM presence:

- `CONNECTED` only when a chat-list selector is visible and no auth/QR selector
  is visible. Chat-item evidence is recorded when available.
- `AUTHENTICATING` when the chat list and an auth/QR selector are both visible.
- `LOGIN_REQUIRED` when auth/QR is visible.
- `UNKNOWN` otherwise.

`createPlaywrightProbe(page)` wraps `locator(...).isVisible()` and `.count()` and
converts locator errors to `false`/`0`.

### Login monitor

`waitForConnected` polls every 2 s, requires two consecutive `CONNECTED`
results, times out after 15 minutes, and treats a persistent `UNKNOWN` for 20 s
as `TELEGRAM_UI_CHANGED`. A closed page raises `BROWSER_CLOSED`. State-change
callbacks feed the controller view.

### QR and 2FA

QR scanning, phone login, and two-step verification happen inside the visible
Telegram Web window. The connector never reads, stores, or forwards QR content,
login codes, or 2FA passwords. Login success is inferred only from the visible
chat list. Logout/revocation is detected indirectly: Telegram Web returns to the
auth/QR UI and the prompt reappears.

## 6. Account architecture

### Store

`AccountStore` keeps `config/accounts.json`, an array of
`{ id, label, profileDir, createdAt, lastConnectedAt? }`:

- Reads validate every field and reject a corrupted file with
  `INTERNAL_ERROR`.
- `create` generates a UUID, labels it `Account N`, and creates the profile
  directory.
- `updateLastConnected` and `remove` rewrite the array.
- Writes use a temporary file plus `rename` so a crash cannot leave a partial
  JSON file.
- No cookie, token, password, QR payload, or message content is stored.

### Controller

`src/main/account-controller.ts` holds the single-account lifecycle:

- `getView()` returns a copy of the renderer-safe view (`id`, `label`, `status`,
  `loginState`, `error`, `createdAt`, `lastConnectedAt`). It contains no path.
- `start()` de-duplicates concurrent calls, creates or loads the first stored
  account, resolves the proxy once, launches the browser, navigates to Telegram
  Web, sets `waiting_for_login`, and starts the monitor without blocking the
  IPC response.
- Status transitions: `disconnected → initializing → waiting_for_login /
  authenticating → connected`, with `error` on failure.
- A navigation failure while a proxy is configured becomes `PROXY_ERROR`; other
  failures are serialized by code.
- On `CONNECTED`, `lastConnectedAt` is persisted.
- `stop()` closes the browser and returns to `disconnected`.
- `remove(deleteProfile)` stops the browser, removes metadata, and deletes the
  account profile directory only when `deleteProfile === true`.
- `handleBrowserClosed()` marks the account as `BROWSER_CLOSED` unless the close
  was initiated by `stop()`.

### IPC, preload, dashboard

The six channels and one event in §3 are the entire account API surface.
`App.tsx` renders connector/browser/login status, the account label, the last
connected time, an error alert, and the actions Add Account, Connect, Open
Telegram, Disconnect, and Remove Account (with a native confirm). It renders no
path, proxy credential, or session data.

## 7. Network architecture

### Resolution order

`resolveProxy` in `proxy-resolver.ts` implements the order in ADR-013:

1. `CONNECTOR_PROXY_SERVER` (manual) — authoritative.
2. `SPIKE_PROXY` (Phase 0 compatibility) — authoritative.
3. Windows WinINET registry, when `ProxyEnable` is set.
4. `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY` (case variants) plus `NO_PROXY`.
5. Direct.

An invalid explicit manual or Phase 0 value raises `PROXY_ERROR`; it never
falls back silently. Registry/environment sources are best-effort. Windows
`ProxyServer` values of the form `http=…;https=…;socks=…` are reduced with
preference `https → http → socks/socks5`.

### Validation and redaction

`parseProxyServer` accepts `http`, `https`, and `socks5`, requires a host and an
explicit port, rejects paths/queries/hashes and out-of-range ports, separates
credentials, and normalizes the server to `scheme://host:port`.
`redactProxyServer` strips userinfo. Proxy credentials are kept out of logs,
IPC, and persisted data. `describeProxy` logs only source, mode, redacted server,
and whether auth is required.

### Windows registry reader

`windows-proxy.ts` runs `reg.exe query HKCU\...\Internet Settings` for
`ProxyEnable`, `ProxyServer`, and `ProxyOverride`. It parses the
`REG_SZ`/`REG_EXPAND_SZ`/`DWORD` value column. **WinHTTP is intentionally not
read** because Chromium uses WinINET, not the service proxy.

### Application to Chromium

`toPlaywrightProxy` maps the resolution to Playwright's `proxy` option
(`server`, `bypass`, `username`, `password`). Chromium receives
`--proxy-server=…` plus `--proxy-bypass-list=…`; credentials are supplied by
Playwright. The OS proxy configuration is never modified.

### Explicit versus system proxy

Phase 0 succeeded with an explicit `SPIKE_PROXY`; automatic inheritance was not
proven. Phase 2 reads the Windows setting and passes it explicitly, so the
connector controls and reports the source. When resolution is `direct`, no
proxy argument is passed and Chromium may still apply its own Windows proxy
behavior; this is not attributed to a resolver source. Live proof of system
proxy inheritance remains a Task 8 manual item.

### VPN / TUN

There is no VPN or TUN detection. A TUN VPN affects traffic at the OS routing
layer, outside this resolver. A VPN that configures WinINET appears as source
`windows`. This behavior is untested in Phase 2.

## 8. Testing architecture

| Layer | Location | Count at Task 8 | What it proves |
|---|---|---|---|
| Unit | `tests/unit/` | 17 files / 103 tests | Pure logic: proxy resolution, registry parsing, lock, detector, monitor, store, controller, IPC, paths, windows, errors |
| Integration | `tests/integration/` | 2 files / 11 tests | Real Playwright Chromium: persistence, lock conflict, cleanup, stale-lock recovery, HTTP proxy auth, bypass, proxy loss/recovery, Telegram HTML fixtures |
| Electron E2E | `tests/e2e/` | 1 file / 8 tests | Real Electron: security invariants, preload surface, data paths, dashboard, Playwright in Main, navigation blocking, CSP, quit |
| Live manual | none automated | 0 run | Real QR/2FA/session/restart/proxy behavior; requires the user |

Commands and environment are recorded in `docs/handoff/RESUME_PROMPT.md`.
Integration tests fail loudly (not skip) when the pinned Chromium is missing
(`tests/integration/browser-env.ts`).

Unit tests use fakes for `Page`, `BrowserContext`, launcher, clock, and proxy
resolution. Integration tests use local HTTP servers and never contact Telegram.
Task 8 added stale-lock recovery with a real Chromium and proxy-loss/recovery
through a restartable local proxy. The E2E Playwright-in-Main test resolves the
externalized package from `<appPath>/node_modules/playwright` through
`process.mainModule.require`, because `app.evaluate` has no dynamic-import
callback (ADR-019).

## 9. Divergences from the target architecture

| # | Target (`ARCHITECTURE.md` / ADRs) | Implemented | Reason | Benefit | Limit | Impact | Test status |
|---|---|---|---|---|---|---|---|
| 1 | Playwright/Chromium bundled with the installer (ADR-007) | `playwright` is a runtime dependency; browsers come from `PLAYWRIGHT_BROWSERS_PATH` in dev | Phase 6 owns packaging; Phase 2 verifies the dev path | Fast iteration; electron-vite externalizes correctly | A fresh machine without the pinned browser fails at launch until `npx playwright install chromium` or the env var is set | Phase 6 must bundle Chromium and set the path | Dev path verified |
| 2 | Proxy systems are abstracted behind the resolver | Chromium can still use its native Windows proxy when resolution is `direct` | Chromium defaults are not disabled | Organic system-proxy fallback | Source attribution can be wrong if the registry is unreadable | Report must not claim source when `direct` | Registry/env/apply/bypass tested; inheritance live-unproven |
| 3 | Per-account serialized Task Queue | Single account; `BrowserManager.running` + `start()` promise serialize | Phase 2 is single-account | Simpler state machine | Stop-during-launch can leave a running browser while the view says disconnected (UI disables the buttons, IPC does not) | Phase 4 queue must close this gap | Not tested |
| 4 | Account Registry, permissions, audit logger | JSON store + controller only | Later phases | Minimal MVP | No audit trail or policy enforcement yet | Phase 4/5 | Store tested; policy not implemented |
| 5 | Account view reflects persisted metadata at launch | `getView()` starts at `EMPTY_VIEW`; the stored account is loaded on first `start()` | Task 6 kept view transitions connection-driven | No secret/path exposure | After a restart the dashboard shows "Add Account" even though an account exists; clicking it reconnects the stored account (no duplicate) | UI copy/labeling needs a Phase 3 fix | Initial empty view tested; restart UX not tested |
| 6 | Named Pipe MCP bridge | Not implemented | Phase 5 | — | No agent integration yet | Future | — |
| 7 | System tray / close-to-tray (optional) | Not implemented; closing the window quits | Phase 2 scope | Simpler lifecycle | None for MVP | — | Quit-on-last-window tested |
| 8 | `web.telegram.org` start URL | `/k/` only (ADR-011) | Phase 0 evidence | Stable selector set | Other variants unsupported | Phase 3+ | URL validator tested |
| 9 | IPC handlers as one function per version | Typed handler map, per-channel dispatch, validated remove payload | Task 7 added multiple channels and one payload | Type safety and explicit validation | More code in the router | — | IPC unit + E2E tested |
| 10 | No test-only IPC surface | E2E loads Playwright through `process.mainModule` | Avoid a self-test channel in production | Minimal preload surface | `process.mainModule` is a deprecated Node API; test-only | Replace if Electron Main moves to ESM | E2E passes |

## 10. Security invariants verified by tests

- The renderer has no `require`, `process`, `Buffer`, `module`, or
  `ipcRenderer`; only `window.api` exists (E2E).
- Only six allowlisted IPC channels are registered; untrusted senders and
  foreign URLs get `PERMISSION_DENIED` (unit).
- IPC payloads are validated; a non-boolean `deleteProfile` gets
  `INVALID_ARGUMENT` and never reaches the controller (unit + E2E).
- Permission requests and new windows are denied; navigation to another URL is
  blocked (E2E).
- The production CSP has no inline script, no external connect source, and no
  frame embedding (E2E).
- `AccountView` carries no profile path, proxy credential, cookie, or token
  (unit + E2E string assertions).
- Proxy credentials are redacted from descriptions and never persisted; only
  error codes are logged (unit).
- Profile removal deletes data only with an explicit boolean confirmation
  (unit + UI confirm).
- No `api_id`, `api_hash`, Bot Token, MTProto, Telethon, or GramJS exists in the
  codebase.

## 11. Known environment facts and limits

- **`ELECTRON_RUN_AS_NODE=1`.** The DSH shell exports it (not User/Machine
  environment). Electron then runs as plain Node and rejects Playwright's
  `--remote-debugging-port=0`, so E2E fails. It must be unset for the Electron
  child process. No OS-level change is needed or made.
- **`PLAYWRIGHT_BROWSERS_PATH`.** Product code never reads it. Playwright 1.65.0
  expects Chromium revision 1254 (Chrome for Testing 158.0.8127.18); the
  repository keeps it in gitignored `spike/.browsers`. The default
  `%LOCALAPPDATA%\ms-playwright` cache is absent on this machine. Dev and tests
  set `spike/.browsers`; Phase 6 must ship a matching browser.
- The E2E launcher strips `ELECTRON_RUN_AS_NODE` from the child environment, so
  `npm run check` passes even when the agent shell exports it. `npm run dev` and
  `npm start` inherit the shell environment, so a GUI session must unset it in
  that shell.
- Page crash is logged but does not yet close the context; only context close
  drives `BROWSER_CLOSED`.
- `uncaughtException` exits immediately; a running Playwright browser may
  outlive the app in that path.

## 12. How to verify this document

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
npm run check
```

`npm run check` strips `ELECTRON_RUN_AS_NODE` for its E2E child process; unset it
only for interactive `npm run dev` / `npm start`.

For each claim in §3–§7, the corresponding unit/integration/E2E test is named in
`tests/`. `git log --oneline` shows the commit that introduced each component.
