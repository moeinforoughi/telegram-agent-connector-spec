# Phase 2 — Final Verification Report

Status: **COMPLETE FOR MVP — ACCEPTED DEFERRED VERIFICATIONS**.
The MVP scope (real Telegram login through a user-configured proxy + session
persistence across browser restart) is verified. The remaining checks are
accepted as deferred and are not treated as failures. Phase 3 may start.

Date: 2026-11-10
Branch: `main`
Final proxy implementation commit: `51714cf` (saved-proxy application fix)
Earlier proxy implementation commit: `67cb669`
Earlier automated verification commit: `582c01a`
Architecture reference: `docs/architecture/IMPLEMENTED_ARCHITECTURE.md`

## 1. Scope

Phase 2 delivers one real Telegram account through a visible Telegram Web (WebZ
`/k/`) window, with a persistent profile, a **user-configured manual proxy**,
login detection, account metadata, allowlisted IPC, and a single-account
dashboard. MCP, multi-account queues, permissions, audit logging, and packaging
are later phases.

The final proxy fix replaced automatic system-proxy detection with a general
manual proxy configuration (ADR-020) and stopped closing the browser on network
errors (ADR-021).

## 2. Commits reviewed

| Commit | Content |
|---|---|
| `7c51c03` | Reconcile the stale handoff with the real tree |
| `07f20d9` | Account IPC, preload bridge, single-account dashboard |
| `bcfda54` | Task 7 completion state |
| `0ac40fe` | Permanent session-independent development rules |
| `9c2d0d2` | Implemented architecture and ADR-015…019 |
| `582c01a` | Task 8 automated verification tests |
| `378f294` | Audit scope alignment |
| `67cb669` | Manual proxy configuration, secure credentials, browser preservation |
| `51714cf` | Persist the Enable toggle and apply the saved proxy to Chromium |

No commit was amended, rebased, squashed, or pushed.

## 3. Automated verification

Environment:

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
# ELECTRON_RUN_AS_NODE was left at 1; the E2E launcher strips it.
npm run check
```

Result: **exit 0** on commit `51714cf`.

| Stage | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | Pass |
| Lint | `eslint .` | Pass |
| Format | `prettier --check .` | Pass |
| Unit | `vitest run tests/unit` | 18 files / 108 tests pass |
| Integration | `vitest run tests/integration` | 2 files / 13 tests pass (real Chromium) |
| Build | `electron-vite build` | Pass |
| Electron E2E | `vitest run tests/e2e` | 1 file / 11 tests pass |

## 3.1 Live manual results (2026-11-10)

The user ran the app on Windows with a real personal Telegram account.

| Test | Result | Evidence |
|---|---|---|
| Real Telegram login | **PASS** | Chromium opened; login completed; dashboard showed Account status Connected and Login Connected |
| Login method (QR vs phone) | Not recorded | The user did not specify the method; QR is not marked PASS |
| 2FA | Not confirmed | Not reported as performed; not marked PASS |
| Browser close / reopen | **PASS** | Browser reopened and Telegram stayed logged in |
| Session persistence across browser restart | **PASS** | No new QR or login was needed |
| Electron full restart | **Pending** | Not run yet |
| Windows full restart | **Pending** | Not run yet |
| Proxy loss / recovery in the app | **Pending** | Not run yet |
| Session revoke detection | **Pending** | Not run yet |

### Which proxy and port succeeded

- The persisted `config/proxy.json` at test time was:
  `enabled: true`, `protocol: socks5`, `host: 127.0.0.1`, `port: 12334`.
- The final successful connection therefore used **SOCKS5 `127.0.0.1:12334`
  (Hiddify)**, not 10808.
- Attempts through 10808 produced `PROXY_ERROR`; 12334 progressed and reached
  the Connected state.

### Why 10808 produced PROXY_ERROR

- A post-test re-check showed both 10808 and 12334 accept a TCP tunnel to
  `web.telegram.org:443`.
- However, a fresh Chromium navigation through `socks5://127.0.0.1:10808`
  failed, while the same navigation through `socks5://127.0.0.1:12334` returned
  HTTP 200 and loaded Telegram Web.
- `PROXY_ERROR` in this case means **Telegram Web was not reachable through that
  proxy route**; it does not mean the port was closed, and the connector did not
  fall back to direct. Mapping a navigation failure under an enabled proxy to
  `PROXY_ERROR` is the intended fail-closed behavior.
- Limitation: `PROXY_ERROR` conflates "proxy unavailable" with "Telegram
  unreachable through the proxy". Test Proxy proves a TCP tunnel, not Telegram
  TLS/HTTP reachability.

### TELEGRAM_UI_CHANGED

- It can come from two code paths: `openTelegram` when the final URL is not
  WebZ `/k/`, or the login monitor when the UI stays `UNKNOWN` for 20 seconds.
- The exact branch cannot be attributed because the app logs to the console and
  does not persist a log file (`logs/` was empty). It occurred during an earlier
  attempt and did not persist: the final attempt reached `/k/` and Connected.
- Limitation: no persisted, redacted technical log exists for post-mortem
  analysis.

### Evidence caveat

At documentation time the default data directory
(`%LOCALAPPDATA%\UnofficialTelegramAgentConnector`) contains the 12334 proxy
settings, but `config/accounts.json` is `[]` and `profiles/` is empty. The
account/profile from this test is therefore not present in the default data
directory now (removed after the test or the app was run with a different
`CONNECTOR_USER_DATA_DIR`). The PASS results above are recorded from the user's
report; the session itself cannot be re-inspected here.

## 4. Manual proxy configuration

UI (Network / Proxy card):

| Field | Behavior |
|---|---|
| Enable proxy | Off by default; connection uses no proxy when off |
| Protocol | SOCKS5 or HTTP |
| Host / IP | Free text; default `127.0.0.1` |
| Port | Integer 1–65535; default `10808` |
| Username / Password | Optional; password is never returned to the renderer |
| Test Proxy | Real tunnel test before saving |
| Save Settings | Validates and persists |

Defaults are editable form values only; no proxy logic is hardcoded to a vendor
or port. There is no automatic fallback: a failed proxy produces an error and
keeps the user's selection.

### Persistence and credential protection

- `config/proxy.json` stores enabled, protocol, host, port and an encrypted
  credentials blob.
- Username/password are encrypted with the asynchronous Electron `safeStorage`
  API (`encryptStringAsync` / `decryptStringAsync`, DPAPI on Windows). If
  encryption is unavailable, credentials are not written at all and the UI
  warns.
- The file never contains the username or password in plain text; E2E reads the
  file and asserts this.
- No proxy credential is logged or returned over IPC.

### Test Proxy semantics

`proxy-probe.ts` performs a real HTTP `CONNECT` or SOCKS5 `CONNECT` handshake to
`web.telegram.org:443`. Merely accepting a TCP connection is not success: a
silent open port times out. Reported statuses:

`success`, `connection_refused`, `timeout`, `auth_failed`,
`proxy_unavailable`, `invalid_config`.

## 5. Proxy verification matrix

| Requirement | Evidence | Status |
|---|---|---|
| Manual SOCKS5 proxy | Integration `navigates through a SOCKS5 proxy`; real local probe | Pass |
| Manual HTTP proxy | Integration HTTP proxy with credentials and bypass | Pass |
| Proxy authentication | HTTP Basic integration; SOCKS5 username/password in probe | Pass (probe) |
| Invalid host / port | Unit validation and probe `invalid_config` | Pass |
| Proxy unavailable / refused | Unit probe `connection_refused` and `proxy_unavailable` | Pass |
| Connection timeout | Unit probe against a silent but open port | Pass |
| Proxy loss / recovery | Integration: navigation fails down, succeeds after restart | Pass |
| Settings persistence | Unit store + E2E relaunch with the same user data dir | Pass |
| Credential protection | Unit + E2E file assertions; safeStorage unavailable path | Pass |
| Chromium navigation through proxy | Integration HTTP and SOCKS5; real Telegram 200 via `12334` | Pass |
| Browser preservation after navigation error | Controller unit + integration process/page assertions | Pass |
| Saved settings reach Playwright | Integration: store → `toPlaywrightProxyConfig` → persistent Chromium → proxy request | Pass |
| Enable toggle persists without Save | E2E reads `proxy.json` after only checking the box | Pass |
| Real Telegram login | User-confirmed Connected state | **PASS** |
| Real QR login / 2FA | Login method not recorded; 2FA not confirmed | Not confirmed |
| Real proxy loss/recovery in the app | Requires the user | Pending manual |

### Real environment evidence (2026-11-10)

- `probeProxy` reached `web.telegram.org:443` through:
  - `socks5://127.0.0.1:10808` — success (~3 ms)
  - `socks5://127.0.0.1:12334` — success (~1 ms)
  - `http://127.0.0.1:10808` — success (~10 ms)
- Chromium loaded `https://web.telegram.org/k/` with HTTP 200, title
  "Telegram Web", through `socks5://127.0.0.1:12334` (no login performed).
  A fresh navigation through `socks5://127.0.0.1:10808` failed at the same time
  even though its TCP tunnel probe succeeded; see §3.1.
- Live DOM inspection (through 12334): `#auth-pages` and
  `#auth-pages canvas` exist after Telegram Web boots, so the centralized
  selectors still recognize the login/QR page.

## 5.1 Saved-proxy root cause and fix (2026-11-10)

Observed on the real machine: Test Proxy and Save succeeded, but Add Account
logged `starting browser (direct)`, followed by `NETWORK_ERROR`; the stored
`config/proxy.json` actually contained `"enabled": false`.

Findings:

- The Add Account path itself was correct: the controller reads the stored
  settings, `toPlaywrightProxyConfig` builds
  `{ server: "socks5://127.0.0.1:10808" }`, and the launcher passes it to
  `chromium.launchPersistentContext`. A clean E2E save/reload passes.
- The real mismatch was UI state versus disk: the form was persisted only on an
  explicit Save, and the asynchronous initial settings read could overwrite a
  toggle made before it resolved. A checked "Enable proxy" box could therefore
  coexist with `enabled:false` on disk.
- The old log line printed only `direct`/`proxy` and hid the actual stored
  values, which made the mismatch invisible.

Fix in `51714cf`:

- Checking/unchecking Enable Proxy now persists immediately; Save is no longer
  required for the enabled flag.
- The initial settings response cannot overwrite form edits anymore.
- The controller logs `proxy.enabled`, `proxy.protocol`, `proxy.host`,
  `proxy.port`, and `mode`; credentials are never logged.
- Fail-closed: if the proxy is enabled but cannot be applied, start fails with
  `PROXY_ERROR` instead of launching Chromium directly.
- `BROWSER_CLOSED` is emitted only when the Chromium context really closes;
  BrowserManager now logs `context closed`. Navigation errors continue to keep
  the browser, profile and session open for Retry.
- `safeStorage` migrated to the asynchronous API
  (`isAsyncEncryptionAvailable`, `encryptStringAsync`, `decryptStringAsync`);
  the deprecation warning is gone.
- New tests: UI toggle auto-persistence (E2E), saved settings →
  Playwright → Chromium (integration), proxy log metadata and fail-closed
  (unit).

Because the existing `proxy.json` on the development machine has
`"enabled": false`, the user must enable the proxy once more; with this fix it is
written immediately.

## 6. Browser lifecycle

- Browser launch is followed by `page.goto(..., { waitUntil: "domcontentloaded" })`.
  `networkidle` is not used.
- If navigation fails after a successful launch, the browser, profile and
  session stay alive; the view shows the precise error and Reconnect retries
  navigation in the same context (ADR-021).
- The browser is relaunched only when the proxy configuration changed or the
  page was closed. A late launch after `stop()` is closed instead of leaking.
- A user-closed browser still maps to `BROWSER_CLOSED`; `stop()` closes
  intentionally.

### Open architecture gap: close reason vs session state

The user asked to distinguish three runtime situations and to keep the stored
session separate from the browser runtime:

- **Intentionally closed** (the user closes the Chromium window): currently
  mapped to the `BROWSER_CLOSED` error view, because Playwright's context `close`
  event does not say who closed it.
- **Unexpectedly closed**: indistinguishable from the above at the context
  level.
- **Crashed**: `page.on("crash")` is only logged today, then the context close
  looks the same as a normal close.

The profile-backed session itself is separate from this runtime state and is not
deleted when the browser closes (proven by the PASS browser-restart test). This
turn was documentation-only, so the state model was not changed. Follow-up work
(not started): model `browserRuntime: running | closed | crashed` separately from
`session: stored | unknown | expired`, treat a user close as informational, and
reserve error state for crashes/unexpected closes.

## 7. Task 7 review (unchanged by the proxy fix)

| Check | Result |
|---|---|
| Account IPC works | Pass (unit router + E2E) |
| Preload stays minimal | Pass (E2E; now 9 functions + 1 subscription) |
| Renderer has no Node access | Pass (E2E) |
| IPC validation preserved | Pass (unit + E2E) |
| Dashboard ↔ Main | Pass (E2E) |
| Account metadata | Pass (atomic JSON, no secrets) |
| No path/credential leak | Pass (unit + E2E) |

`process.mainModule.require` in E2E remains test-only and deprecated; no product
code depends on it (ADR-019).

## 8. Live manual checklist (Pending — requires the user)

Prerequisites: Windows 11 x64, the repository, a phone with a logged-in Telegram
account, and a running local proxy (the current machine has V2RayN on
`127.0.0.1:10808` and Hiddify on `127.0.0.1:12334`). Never send QR codes, login
codes, 2FA passwords, cookies, or session files to an agent or chat.

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run dev
```

| # | Step | Expected |
|---|---|---|
| 1 | Open Network / Proxy, enable it, choose SOCKS5, host `127.0.0.1`, port `10808` | Fields accept the values; enabling persists immediately |
| 2 | Click Test Proxy | “Proxy connection succeeded” |
| 3 | Click Save Settings (optional for the enable flag) | “Proxy settings saved.” |
| 4 | Click Add Account | Visible Chromium opens; Telegram login page loads (no network error) |
| 5 | Scan the QR with the phone | Desktop session logs in |
| 6 | Complete 2FA inside Telegram Web if requested | Login proceeds |
| 7 | Check the dashboard | Connected; no path or credential shown |
| 8 | Close the Chromium window | `BROWSER_CLOSED` error, not a silent disconnect |
| 9 | Click Reconnect | Browser reopens with the existing profile; chat list appears |
| 10 | Close the app window, relaunch, click Add Account | Proxy settings persisted; session restored |
| 11 | Restart Windows, relaunch, repeat 10 | Session still restored |
| 12 | Stop the proxy, click Reconnect | Clear `PROXY_ERROR`; the browser stays open; proxy settings unchanged |
| 13 | Restart the proxy, click Reconnect | Connected again without a new QR |
| 14 | Change to Hiddify (`127.0.0.1:12334`, Disconnect first) | Connects through the second proxy |
| 15 | Revoke the session from the phone (Settings → Devices) | Reconnect shows the login/QR prompt |
| 16 | Record every result in the handoff | Actual evidence, not assumptions |

Notes:

- Changing the proxy while connected takes effect on the next connection:
  Disconnect, save the new settings, then Connect.
- A password typed into the form is not echoed after saving; `hasPassword`
  indicates that one is stored.

### Checklist execution status (2026-11-10)

- **Done:** proxy setup/test/save (1–3), Add Account/browser open (4), real
  login (5; method not recorded), Connected (7), browser close (8; semantics gap
  documented), reopen with session intact (9), Hiddify 12334 (14), results
  recorded (16).
- **Pending:** 2FA (6), Electron full restart (10), Windows restart (11), proxy
  stop/restart (12–13), session revoke (15).
- Step 5's QR-specific confirmation and step 6 remain **not confirmed**; do not
  record them as PASS until actually performed and observed.

## 9. Phase 2 exit criteria

| Criterion | Status |
|---|---|
| User can enter any proxy | Yes (UI + validation) |
| Settings persist | Yes (automated) |
| Chromium uses the selected proxy | Yes (integration + real login through 12334) |
| Telegram Web loads | Yes (real, through 12334; the 10808 route failed) |
| Browser is not closed on network error | Yes (unit + integration) |
| Real login | **PASS** (user-confirmed) |
| Real QR login | Login PASS; QR method not recorded |
| Real 2FA | Not confirmed |
| Session persistence with a real account | Browser restart **PASS**; Electron/Windows restart accepted as deferred |
| Automated tests pass | Yes (`51714cf`) |
| Runtime limits documented | Yes |
| Architecture docs updated | Yes |
| Handoff complete | Yes |

**Conclusion: Phase 2 is COMPLETE FOR MVP with accepted deferred verifications.
Phase 3 may start.**

## 9.1 MVP closure decision (2026-11-10)

User-accepted Phase 2 scope:

| Item | Result |
|---|---|
| Telegram Web through proxy | **PASS** |
| Real Telegram login | **PASS** |
| Account/Login status Connected | **PASS** |
| User closes browser window | Done |
| Reopen browser | **PASS** |
| Session persistence across browser restart | **PASS** |
| Successful proxy | SOCKS5 `127.0.0.1:12334` |

Accepted deferred checks — recorded as **NOT TESTED**, not failures:

| Item | Status | Note |
|---|---|---|
| Electron full restart persistence | **NOT TESTED** | The user cleared the session before closing Electron; missing profile/account metadata afterwards is expected, not a data-directory bug |
| Windows full restart | **NOT TESTED** | Out of MVP test scope |
| Proxy loss / recovery in the app | **NOT TESTED** | Out of MVP test scope |
| Session revoke detection | **NOT TESTED** | Out of MVP test scope |
| V2RayN port 10808 troubleshooting | **NOT TESTED** | 10808 route was not selected for the final connection |
| QR vs phone login confirmation | Not recorded | Login itself PASS; method not stated |
| 2FA | Not confirmed | Only mark PASS if actually performed |

The manual proxy architecture remains in place. The current 12334 values are the
user's chosen settings, not a vendor integration; no V2RayN/Hiddify code exists
and any SOCKS5/HTTP proxy can be entered.

## 10. Known limitations carried forward

- SOCKS5 authentication in Chromium/Playwright is unverified; the probe supports
  it and HTTP proxy authentication is covered by integration tests.
- `PROXY_ERROR` conflates "proxy unavailable" with "Telegram unreachable through
  the proxy"; Test Proxy proves only a TCP tunnel.
- The app logs to the console only; there is no persisted redacted log for
  post-mortem analysis of `TELEGRAM_UI_CHANGED` or proxy failures.
- Close reason is not modelled: an intentional user close currently becomes a
  `BROWSER_CLOSED` error, and a crash is only logged (see §6).
- Session state and browser runtime state are not yet separate in the view.
- Proxy changes apply on the next connection, not to an already running browser.
- VPN/TUN is not modelled; only the configured proxy is applied.
- The account view still starts empty after a restart (the stored account is
  reused on connect, but the button says "Add Account" until then).
- Chromium is not bundled yet; Phase 6 owns packaging.
- A page crash is logged but does not close the context.
- No multi-account queue, permissions, audit logger, MCP, or tray yet.
