# Phase 2 — Final Verification Report

Status: **Partially Verified — automated verification passed; live Telegram
checks pending user execution.** Phase 2 is **not** declared complete.

Date: 2026-11-10
Branch: `main`
Automated verification commit: `582c01a`
Last product-code commit: `07f20d9`
Architecture reference: `docs/architecture/IMPLEMENTED_ARCHITECTURE.md`

## 1. Scope

Phase 2 delivered one real Telegram account through a visible Telegram Web
(WebZ `/k/`) window, with a persistent profile, proxy resolution, login
detection, account metadata, allowlisted IPC, and a single-account dashboard.
MCP, multi-account queues, permissions, audit logging, and packaging are later
phases and are not part of this report.

## 2. Commits reviewed

| Commit | Content |
|---|---|
| `7c51c03` | Reconcile the stale handoff with the real tree |
| `07f20d9` | Account IPC, preload bridge, single-account dashboard |
| `bcfda54` | Task 7 completion state |
| `0ac40fe` | Permanent session-independent development rules |
| `9c2d0d2` | Implemented architecture and ADR-015…019 |
| `582c01a` | Task 8 automated verification tests |

All commits are on `main`; no commit was amended, rebased, squashed, or pushed.

## 3. Automated verification

Environment:

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
# ELECTRON_RUN_AS_NODE was left at 1 on purpose; the E2E launcher strips it.
npm run check
```

Result: **exit 0** on commit `582c01a`.

| Stage | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | Pass |
| Lint | `eslint .` | Pass |
| Format | `prettier --check .` | Pass |
| Unit | `vitest run tests/unit` | 17 files / 103 tests pass |
| Integration | `vitest run tests/integration` | 2 files / 11 tests pass (real Chromium) |
| Build | `electron-vite build` | Pass |
| Electron E2E | `vitest run tests/e2e` | 1 file / 8 tests pass |

The E2E suite passed while `ELECTRON_RUN_AS_NODE=1` was exported, proving the
launcher-level sanitization added in `582c01a`.

## 4. Browser integration matrix

| Requirement | Evidence | Status |
|---|---|---|
| Chromium launch | Integration `persists localStorage…` launches the pinned Chromium | Pass |
| Persistent context | `launchPersistentContext`; localStorage survives close/reopen | Pass |
| Profile lock | Integration `refuses a second Chromium context…`; unit lock tests | Pass |
| Browser restart | Profile closed and reopened in the same test | Pass |
| Process cleanup | Integration asserts `browser.isConnected() === false` after close | Pass |
| Profile recovery | Integration `replaces a stale lock and keeps the profile intact` | Pass |
| Telegram Web navigation | Unit `navigation` tests + live login page | Unit pass; live pending |
| Login state machine | Unit detector/monitor (6 + 7 tests) and local HTML fixtures (4 tests) | Pass (fixtures only) |
| Electron restart | No automated equivalent without a real Telegram session | Pending manual |
| Session persistence with real account | Requires QR login | Pending manual |

## 5. Proxy verification matrix

| Requirement | Evidence | Status |
|---|---|---|
| Detect a configured system proxy | Unit `windows-proxy` registry parsing; `proxy-resolver` priority | Pass (unit) |
| Identify the real source | Resolver returns `manual` / `phase0` / `windows` / `environment` / `direct`; controller logs source+mode only | Pass |
| Apply proxy to Chromium | Integration HTTP proxy with credentials and bypass list | Pass |
| Reach Telegram Web through proxy | Live network/account not available in automation | Pending manual |
| Proxy loss | Integration `fails while the proxy is down…` (navigation rejects) | Pass (mechanism) |
| Correct error surfaced | `BROWSER_CLOSED`, `NETWORK_ERROR`→`PROXY_ERROR` mapping in controller unit tests | Pass (unit) |
| Recovery after proxy returns | Integration reopens a page on the same context and succeeds | Pass (mechanism) |

### Explicit proxy vs system proxy inheritance

Phase 0 succeeded with an **explicit** `SPIKE_PROXY`; it did not prove automatic
system-proxy inheritance. Phase 2 reads the per-user WinINET registry and passes
the proxy explicitly to Playwright, so the connector controls and reports the
source. When the resolver returns `direct`, Chromium may still apply its own
Windows proxy behavior; that path is not attributed to a resolver source and is
not yet proven live. A VPN that configures WinINET appears as `windows`; a
TUN-level VPN is invisible to the resolver. SOCKS5 authentication through
Chromium/Playwright is untested.

## 6. Task 7 review

| Check | Result | Evidence |
|---|---|---|
| Account IPC works | Pass | Six allowlisted channels; unit router tests; E2E `account:get` |
| Preload stays minimal | Pass | E2E asserts exactly `getAppInfo`, `getAccount`, `startAccount`, `stopAccount`, `openTelegram`, `removeAccount`, `onAccountStatus` |
| Renderer has no Node access | Pass | E2E asserts `require`, `process`, `Buffer`, `module` are undefined |
| IPC validation preserved | Pass | Trusted-sender unit tests; invalid `deleteProfile` → `INVALID_ARGUMENT`; E2E path |
| Dashboard ↔ Main | Pass | E2E dashboard renders initial view; status event wired in Main and preload |
| Account metadata | Pass | Atomic `accounts.json`; no secrets; remove deletes profile only with `deleteProfile: true` |
| No path/credential leak | Pass | `AccountView` has no path; unit and E2E string assertions |

### `process.mainModule.require` review

The E2E test loads Playwright through
`process.mainModule.require("<appPath>/node_modules/playwright")` because
Playwright's `app.evaluate` has no dynamic-import callback. Verification:

- It works with Electron 45.2.3 / embedded Node 24.22.2 and the externalized
  runtime dependency.
- `process.mainModule` is deprecated in Node; this is **test-only** code, not
  product code.
- If Electron Main moves to ESM or Node removes the API, the test must switch to
  another injection mechanism; no production surface depends on it.
- The test also asserts a real Chromium launch from the Electron Main process,
  covering the electron-vite externalization risk.

No Task 7 logic was changed during Task 8; only the E2E environment was
hardened.

## 7. Environment findings

### `ELECTRON_RUN_AS_NODE`

- Present only in the DSH shell process environment, not in the Windows User or
  Machine environment. It is inherited from the agent shell.
- When set, the Electron binary boots as plain Node.js. Playwright launches
  Electron with `--remote-debugging-port=0`, which Node rejects:
  `bad option: --remote-debugging-port=0`.
- Fix: the E2E launcher strips the variable from the child environment
  (`launchEnv` in `tests/e2e/app.test.ts`). No Windows environment change is
  made. `npm run check` now passes with the variable set.
- `npm run dev` / `npm start` still inherit the shell environment, so a session
  that needs the GUI must unset it in that shell (`Remove-Item
  Env:ELECTRON_RUN_AS_NODE`). This is an agent-environment concern, not a
  product concern.

### `PLAYWRIGHT_BROWSERS_PATH`

- Product code never reads this variable; Playwright resolves the browser.
- Playwright 1.65.0 pins Chromium revision 1254 / Chrome for Testing
  158.0.8127.18. `spike/.browsers/chromium-1254` matches exactly.
- The default `%LOCALAPPDATA%\ms-playwright` cache is absent on this machine.
  Development and tests therefore set `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers`
  or run `npx playwright install chromium`.
- The final installer must bundle the matching Chromium (ADR-007, ADR-014 and
  Phase 6); the app must not depend on the `spike/` directory.

## 8. Live manual checklist (Pending — requires the user)

Prerequisites: Windows 11 x64, the repository, a phone with a logged-in
Telegram account, and a terminal in the repository root. Never send QR codes,
login codes, 2FA passwords, cookies, or session files to any agent or chat.

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run dev
```

| # | Step | Expected |
|---|---|---|
| 1 | Launch the app | Connector window opens; no browser yet |
| 2 | Click Add Account | Visible Chromium opens to `https://web.telegram.org/k/` |
| 3 | Scan the QR with the phone | Telegram logs the desktop session in |
| 4 | Complete 2FA if requested (inside Telegram Web only) | Login proceeds |
| 5 | Observe the connector | Status Connected; no path or credential shown |
| 6 | Close the Chromium window | App shows `BROWSER_CLOSED` error, not a silent disconnect |
| 7 | Click Reconnect | Browser reopens; chat list appears without a new QR |
| 8 | Close the app window | App quits; no Chromium process remains |
| 9 | Relaunch the app | App opens; click Add Account (it reuses the stored account) |
| 10 | Verify the session | Chat list restored without QR; status Connected |
| 11 | Restart Windows, relaunch, repeat 9–10 | Session still restored |
| 12 | Configure a proxy (Windows Settings or `CONNECTOR_PROXY_SERVER`) | Dev console shows `starting browser (windows/proxy)` or `(manual/proxy)` |
| 13 | Connect with the proxy | Login page loads; Connected |
| 14 | Disable/stop the proxy, click Reconnect | Clear `PROXY_ERROR`; no silent direct connection |
| 15 | Restore the proxy, click Reconnect | Connected again |
| 16 | Revoke the session from the phone (Settings → Devices) | Reconnect shows the login/QR prompt |

Record each result in `docs/handoff/LATEST_HANDOFF.md` (step, expected, actual,
date). Do not mark a step passed without performing it.

## 9. Phase 2 exit criteria

| Criterion | Status |
|---|---|
| Browser integration confirmed | Automated pass; live pending |
| Proxy strategy proven | Mechanism pass; live system-inheritance pending |
| Real QR login | Pending manual |
| Real 2FA | Pending manual |
| Session persistence with a real account | Pending manual |
| Electron restart | Pending manual |
| Automated tests pass | Yes (`582c01a`) |
| Runtime limits documented | Yes (this report + architecture audit) |
| Architecture documentation updated | Yes |
| Handoff complete | Yes |
| All commits recorded | Yes |

**Conclusion: Phase 2 is Partially Verified. Do not start Phase 3.**

## 10. Known limitations carried forward

- Account view starts empty after an app restart; the stored account is reused
  on the next start, but the button still says "Add Account". UX fix proposed
  for Phase 3.
- `stop()` during an in-flight launch can leave the browser running while the
  view says disconnected. The UI disables buttons during the operation; an IPC
  caller could still trigger it. Phase 4 queue/state work should close this.
- A page crash is logged but does not close the context; only a context close
  produces `BROWSER_CLOSED`.
- SOCKS5 proxy authentication is unverified; HTTP proxy authentication is
  covered by integration tests.
- VPN/TUN behavior is not modelled beyond WinINET.
- Chromium is not bundled yet; Phase 6 owns packaging.
