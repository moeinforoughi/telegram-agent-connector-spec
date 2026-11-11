# Implemented Architecture — Phase 0 to Phase 3

Status: current implementation, reconciled against the code and tests in the
repository. Phase 2 live verification is still pending; see
`docs/phase2/PHASE2_REPORT.md`. The connection path is now the user's manual
proxy configuration (ADR-020); system-proxy auto-detection was removed.

Scope: Phase 0 feasibility spike, Phase 1 Electron foundation, Phase 2 (browser,
manual proxy, single account), and Phase 3 multi-account management. This
document records what is **actually implemented**, not only the target design in
`ARCHITECTURE.md`. Where the implementation differs, the difference is listed in
§9 with its reason and limits.

Evidence base: commits `619c095` (Phase 1), `22789a8`–`cce43eb` (Phase 2 Tasks
1–6), `07f20d9` (Task 7), the Task 8 verification commits, and the manual proxy
update (ADR-020/021).

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
| Telegram | `src/core/telegram/selectors/selector-map.ts`, `login-detector.ts`, `login-monitor.ts`, `navigation.ts`, `telegram-types.ts`, `chat-surface.ts` |
| Account | `src/core/account/account-store.ts`, `src/main/account-controller.ts`, `src/main/account-manager.ts`, `src/shared/account.ts` |
| Network | `src/core/network/proxy-server.ts` (parser), `proxy-settings.ts` (store/validation), `proxy-probe.ts` (real tunnel test), `src/main/secure-storage.ts` (safeStorage adapter) |
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
  `BrowserManager` + `AccountStore` + `ProxySettingsStore`, registers the
  allowlisted IPC handlers, then loads the renderer.
- `window-all-closed` quits the app. `before-quit` prevents quit while a browser
  is running, awaits `controller.stop()`, then quits once (`quitReady` guard).
- `uncaughtException` logs the error name and calls `app.exit(1)`;
  `unhandledRejection` logs the error name.
- `render-process-gone` is logged.

### Preload and renderer isolation

`src/main/window-options.ts` sets `contextIsolation: true`, `sandbox: true`,
`nodeIntegration: false`, `webSecurity: true`, `webviewTag: false`,
`allowRunningInsecureContent: false`, `spellcheck: false`.

`src/preload/index.ts` exposes exactly one bridge, `window.api`, with eleven
invoke functions and one subscription:

`getAppInfo`, `listAccounts`, `createAccount`, `renameAccount`, `startAccount`,
`stopAccount`, `openTelegram`, `removeAccount`, `getProxySettings`,
`saveProxySettings`, `testProxy`, `onAccountStatus`.

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
| `account:list` | none | `AccountView[]` |
| `account:create` | `{ label?: string }` | `AccountView` |
| `account:rename` | `{ id: string, label: string }` | `AccountView` |
| `account:start` | `{ id: string }` | `AccountView` |
| `account:stop` | `{ id: string }` | `AccountView` |
| `account:open` | `{ id: string }` | `AccountView` |
| `account:remove` | `{ id: string, deleteProfile: boolean }` | `{ removed: true }` |
| `proxy:get` | none | `ProxySettingsView` |
| `proxy:save` | `SaveProxySettingsRequest` | `ProxySettingsView` |
| `proxy:test` | `ProxyTestRequest` | `ProxyTestResult` |

Event: `account:status` (Main → Renderer) carries one `AccountView`.

`src/main/ipc-router.ts` registers only allowlisted channels, removes stale
handlers first, validates the sender with `isTrustedSender` (sender webContents
id, main frame, and exact current URL), dispatches per channel, validates every
payload shape (account id, label, remove confirmation, proxy fields), and wraps
every result in `{ ok: true, data } | { ok: false, error }`. Failures are logged
by error code only; unknown errors become `INTERNAL_ERROR` with a generic
message.

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
- External context close releases the lock and calls the `onClosed` hook; the
  controller moves the account to `ready` (ADR-023), not an error.

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

## 5.1 Read-only chat surface (Phase 4 Task 1)

`chat-surface.ts` adds a read-only adapter over `Page`:

- `detectMainSurface`, `detectChatList`, `detectOpenChat`, `readMessageStats`,
  `detectSearchState`, `detectChannel`, and a `TelegramDomProbe` with
  `attribute` access.
- All detection is by visible elements/roles/classes; no message text is read.
- Counts only for messages (total/incoming/outgoing/channel posts), no content.
- Unknown/missing UI fails safely as `ui_changed`; no guessing.
- Confirmed against two real sessions and synthetic fixtures. Selector details
  and limitations: `docs/phase4/TASK1_DOM_AUDIT.md`.

## 5.2 Read-only operations (Phase 4 Task 2)

- `src/main/account-action-queue.ts`: one serial queue per account; queues are
  independent, so accounts run in parallel while one account stays sequential.
  Timeout, error recovery and `BROWSER_CLOSED` checks; no global queue.
- `src/main/telegram-read-adapter.ts`: read-only `listChats`, `searchChats`,
  `getChatListState`, `getOpenChatInfo`, `openChat` (explicit only),
  `readVisibleMessages`, `getMessageMetadata`, `getMessageCount`, and
  `classifyMessageDirection`.
- Results are bounded; message text/title/preview/sender are capped. Lists and
  search never open chats; `openChat` may mark a chat read and must be explicit.
- `AccountController.getPage()` / `AccountManager.getPage()` expose the live
  page to Main only; no page, cookie, or token reaches the renderer/Agent.
- Details/limits: `docs/phase4/TASK2_READ_ADAPTER.md`.

## 6. Account architecture

### Store

`AccountStore` keeps `config/accounts.json`, an array of
`{ id, label, profileDir, createdAt, lastConnectedAt? }`:

- `list`, `getById`, `create`, `rename`, `updateLastConnected`, and `remove`
  operate on the registry.
- Every read validates the shape **and** that `profileDir` equals the managed
  path for that id (`profiles/<id>/chromium-user-data`), so a tampered registry
  cannot point outside the profile root.
- A corrupt or invalid registry is renamed to `accounts.json.corrupt-<stamp>`
  (unique suffix if needed) and treated as empty; the original bytes are never
  deleted.
- `create` generates a UUID and the profile directory; labels are trimmed and
  length/control-character validated.
- Writes use a temporary file plus `rename` so a crash cannot leave a partial
  JSON file.
- No cookie, token, password, QR payload, or message content is stored.

### Multi-account manager

`src/main/account-manager.ts` owns account lifecycle:

- One `AccountRuntime` per account: an `AccountController` plus a
  `BrowserManager` (Playwright persistent context). Runtimes are created lazily
  on the first `start`/`open`; `list` and `create` never launch a browser.
- Active browsers are capped (default 3). Exceeding the cap returns
  `BROWSER_LIMIT_REACHED` before any launch.
- `create`, `rename`, `start`, `stop`, `open`, `remove`, and `shutdown` are the
  manager API; `remove` deletes the profile only when `deleteProfile === true`.
- A view cache fans out `account:status` per account; one account's state never
  changes another's.
- `shutdown` stops every running runtime before app quit.

### Controller

`src/main/account-controller.ts` holds the lifecycle of **one fixed account**
(`accountId`):

- `getView()` returns a copy of the renderer-safe view (`id`, `label`, `status`,
  `loginState`, `error`, `createdAt`, `lastConnectedAt`). It contains no path.
- `start()` de-duplicates concurrent calls, reloads the account metadata, reads
  the manual proxy settings, launches the browser (or reuses it), navigates to
  Telegram Web, sets `waiting_for_login`, and starts the monitor.
- Status transitions: `disconnected → initializing → waiting_for_login /
  authenticating → connected`, with `error` on failure.
- A navigation failure while the manual proxy is enabled becomes `PROXY_ERROR`;
  other failures are serialized by code.
- After a successful launch, a navigation/network failure **keeps the browser,
  profile and session** for Retry (ADR-021). A relaunch happens only when the
  proxy configuration changed or the page was closed.
- On `CONNECTED`, `lastConnectedAt` is persisted for that account.
- `stop()` closes the browser and returns to `disconnected`.
- `handleBrowserClosed()` moves the account to `ready`, keeps the last known
  `loginState`, and leaves the profile/session untouched (ADR-023); `stop()`
  produces `disconnected`.

### IPC, preload, dashboard

The 11 channels and one event in §3 are the entire API surface (app info, seven
account channels, three proxy channels). `App.tsx` renders the account list,
one card per account (status, browser, login, last connected, error), an Add
Account field, Rename, Connect/Reconnect, Open Telegram, Disconnect, Remove
(with a native confirm), and the global Network/Proxy form. It renders no path,
proxy credential, or session data.

## 7. Network architecture

### Manual proxy only

The only proxy source is the user's saved manual configuration (ADR-020):
`enabled`, `protocol` (`socks5` or `http`), `host`, `port`, and optional
`username`/`password`. There is no system-proxy detection, no environment
fallback, no vendor preset, and no silent direct fallback. When the proxy is
disabled, Playwright receives no `proxy` option. When it is enabled and invalid,
start fails closed with `PROXY_ERROR` instead of connecting directly. The
controller logs `proxy.enabled`, protocol, host, port, and mode (never
credentials) so the applied routing can be verified from the console.

### Validation

`proxy-server.ts` parses `http`/`https`/`socks5` values with an explicit host and
port, rejects paths, queries, and out-of-range ports, and keeps credentials
separate from the server URL. `proxy-settings.ts` normalizes protocol/host/port,
trims the username, rejects control characters and over-long values, and rejects
a password without a username.

### Application to Chromium

`toPlaywrightProxyConfig` returns Playwright's official `proxy` option:
`{ server: "<scheme>://<host>:<port>", username, password }`. Credentials are
separate fields, never embedded in the URL. Chromium receives
`--proxy-server=...`; the OS proxy configuration is never modified.

### Persistence and credential protection

Settings live in `config/proxy.json`: enabled flag, protocol, host, port, and an
optional encrypted credentials blob. The username/password pair is encrypted
with the asynchronous Electron `safeStorage` API (`encryptStringAsync` /
`decryptStringAsync`, DPAPI on Windows) and stored as base64 ciphertext. If OS
encryption is unavailable, credentials are not persisted at all and the UI shows
that secure storage is unavailable. Passwords are never returned to the renderer
(`hasPassword` only), logged, or stored in plain text. The UI persists the
enabled flag immediately when the toggle changes, and an initial settings read
cannot overwrite form edits made in the meantime.

### Test Proxy

`proxy-probe.ts` opens a real TCP tunnel through the configured proxy: HTTP
`CONNECT` or SOCKS5 `CONNECT` to `web.telegram.org:443` by default. An open port
alone is not success. Statuses are `success`, `connection_refused`, `timeout`,
`auth_failed`, `proxy_unavailable`, and `invalid_config`. An open port that never
answers the handshake times out.

### VPN / TUN

There is no VPN or TUN control. A system-level TUN affects routing outside the
connector; the configured proxy is the only proxy the connector applies.

## 8. Testing architecture

| Layer | Location | Count at Phase 2 final | What it proves |
|---|---|---|---|
| Unit | `tests/unit/` | 21 files / 134 tests | Pure logic: proxy parsing/settings/probe, account registry/manager/controller, Telegram surface, action queue, lock, detector, monitor, IPC, paths, windows, errors |
| Integration | `tests/integration/` | 4 files / 31 tests | Real Playwright Chromium: persistence, lock conflict, cleanup, stale-lock recovery, HTTP proxy auth, SOCKS5, bypass, proxy loss/recovery, saved-settings→Playwright, Telegram HTML fixtures, read-only chat surface, read adapter |
| Electron E2E | `tests/e2e/` | 1 file / 13 tests | Real Electron: security invariants, preload surface, data paths, multi-account dashboard/list/create-three, proxy form, immediate enable persistence, credential protection, Playwright in Main, navigation blocking, CSP, quit |
| Live manual | user-run | 0 run | Real QR/2FA/session/restart through the user's proxy; requires the user |

Commands and environment are recorded in `docs/handoff/RESUME_PROMPT.md`.
Integration tests fail loudly (not skip) when the pinned Chromium is missing
(`tests/integration/browser-env.ts`).

Unit tests use fakes for `Page`, `BrowserContext`, launcher, clock, and account
state; proxy probing is tested against local HTTP and SOCKS5 servers. Integration
tests use local HTTP/SOCKS5 proxies and never contact Telegram. The proxy probe
was also exercised against the user's two real local proxies (both reached
`web.telegram.org:443`) and Telegram Web loaded with HTTP 200 through
`socks5://127.0.0.1:10808`; QR/2FA remains manual. The E2E Playwright-in-Main
test resolves the externalized package from `<appPath>/node_modules/playwright`
through `process.mainModule.require`, because `app.evaluate` has no
dynamic-import callback (ADR-019).

## 9. Divergences from the target architecture

| # | Target (`ARCHITECTURE.md` / ADRs) | Implemented | Reason | Benefit | Limit | Impact | Test status |
|---|---|---|---|---|---|---|---|
| 1 | Playwright/Chromium bundled with the installer (ADR-007) | `playwright` is a runtime dependency; browsers come from `PLAYWRIGHT_BROWSERS_PATH` in dev | Phase 6 owns packaging; Phase 2 verifies the dev path | Fast iteration; electron-vite externalizes correctly | A fresh machine without the pinned browser fails at launch until `npx playwright install chromium` or the env var is set | Phase 6 must bundle Chromium and set the path | Dev path verified |
| 2 | System Proxy First + Manual Fallback (ADR-013) | Manual proxy only; no system detection, no fallback (ADR-020) | User's Windows system proxy is unset while local proxies run; automatic detection produced `direct` and a network error | Deterministic, vendor-neutral, testable, no OS changes | User must configure the proxy once; nothing is auto-detected | Proxy UI + persistence + Test Proxy | Unit/integration/E2E; real local proxies verified |
| 3 | Per-account serialized Task Queue | `AccountManager` creates one runtime per account (ADR-022); same-account `start()` is serialized by an in-flight promise; max 3 active browsers | Phase 3 needs isolated accounts but no Telegram operations yet | Account isolation, lazy launch, bounded resources | No generic task queue for non-lifecycle operations; remove-during-start race is untested | Phase 4 adds the operation queue | Manager/unit + E2E multi-account tests |
| 4 | Account Registry, permissions, audit logger | JSON registry + account manager only | Later phases | Minimal MVP | No audit trail or policy enforcement yet | Phase 4/5 | Store/manager tested; policy not implemented |
| 5 | Account view reflects persisted metadata at launch | Per-account views are initialized from the registry; the manager lists accounts before any browser starts | Phase 3 multi-account UI | Correct account list and labels after restart; normal browser close is `ready` with last-known login (ADR-023) | Crash vs normal close is not distinguished; a real crash is only logged | Follow-up crash detection | Store/manager/E2E tested; close semantics covered for normal close |
| 6 | Named Pipe MCP bridge | Not implemented | Phase 5 | — | No agent integration yet | Future | — |
| 7 | System tray / close-to-tray (optional) | Not implemented; closing the window quits | Phase 2 scope | Simpler lifecycle | None for MVP | — | Quit-on-last-window tested |
| 8 | `web.telegram.org` start URL | `/k/` only (ADR-011) | Phase 0 evidence | Stable selector set | Other variants unsupported | Phase 3+ | URL validator tested |
| 9 | IPC handlers as one function per version | Typed handler map, per-channel dispatch, validated account-id/label/remove/proxy payloads | Task 7 added multiple channels; Phase 3 added account ids | Type safety and explicit validation | More code in the router | — | IPC unit + E2E tested |
| 10 | No test-only IPC surface | E2E loads Playwright through `process.mainModule` | Avoid a self-test channel in production | Minimal preload surface | `process.mainModule` is a deprecated Node API; test-only | Replace if Electron Main moves to ESM | E2E passes |

## 10. Security invariants verified by tests

- The renderer has no `require`, `process`, `Buffer`, `module`, or
  `ipcRenderer`; only `window.api` exists (E2E).
- Only eleven allowlisted IPC channels are registered; untrusted senders and
  foreign URLs get `PERMISSION_DENIED` (unit).
- IPC payloads are validated; a non-boolean `deleteProfile` or malformed proxy
  payload gets `INVALID_ARGUMENT` and never reaches the services (unit + E2E).
- Permission requests and new windows are denied; navigation to another URL is
  blocked (E2E).
- The production CSP has no inline script, no external connect source, and no
  frame embedding (E2E).
- `AccountView` carries no profile path, proxy credential, cookie, or token
  (unit + E2E string assertions).
- Proxy credentials never reach the renderer (`hasPassword` only), are never
  embedded in the Playwright server URL, are never logged, and are encrypted
  with OS secure storage or not persisted at all (unit + E2E file assertions).
- Profile removal deletes data only with an explicit boolean confirmation
  (unit + UI confirm).
- No `api_id`, `api_hash`, Bot Token, MTProto, Telethon, or GramJS exists in the
  codebase.

## 11. Known environment facts and limits

- **`ELECTRON_RUN_AS_NODE=1`.** The DSH shell exports it (not User/Machine
  environment). Electron then runs as plain Node and rejects Playwright's
  `--remote-debugging-port=0`. The E2E launcher strips it for the child process;
  interactive `npm run dev` in that shell must unset it. No OS-level change is
  needed or made.
- **Proxy credentials.** On Windows, `safeStorage` normally uses DPAPI. If it is
  unavailable, the store refuses to persist credentials and the UI warns; it
  never writes them in plain text.
- **`PLAYWRIGHT_BROWSERS_PATH`.** Product code never reads it. Playwright 1.65.0
  expects Chromium revision 1254 (Chrome for Testing 158.0.8127.18); the
  repository keeps it in gitignored `spike/.browsers`. The default
  `%LOCALAPPDATA%\ms-playwright` cache is absent on this machine. Dev and tests
  set `spike/.browsers`; Phase 6 must ship a matching browser.
- The E2E launcher strips `ELECTRON_RUN_AS_NODE` from the child environment, so
  `npm run check` passes even when the agent shell exports it. `npm run dev` and
  `npm start` inherit the shell environment, so a GUI session must unset it in
  that shell.
- Page crash is logged but does not yet close the context; an external context
  close moves the account to `ready` (ADR-023).
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
