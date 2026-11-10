# Phase 2 — Browser Manager, Proxy & Single Account Login

> **For agentic workers:** Execute task by task with TDD. Track progress in
> `docs/handoff/LATEST_HANDOFF.md` and `docs/handoff/SESSION_LOG.md`.

**Goal:** Move the proven Phase 0 browser login into the Electron app: one real
Telegram account, visible Chromium, proxy handling, QR/2FA by the user, and a
profile whose session survives browser and app restarts.

**Architecture:** Main process owns a `BrowserManager` built on Playwright
`launchPersistentContext`. A proxy resolver decides which proxy source to use.
A Telegram adapter centralizes selectors and login detection. An account store
keeps non-secret metadata; the renderer only gets status views over allowlisted
IPC.

**Tech Stack:** Electron 45.2.3, Playwright 1.65.0 (Chrome for Testing
158.0.8127.18), TypeScript 5.9.3, React 19.3.1, Vitest 5.1.0.

**Spec:** `TASKS/02_DESKTOP_SHELL.md`, `TASKS/03_BROWSER_LOGIN_SESSION.md`,
Phase 2 instruction set supplied 2026-11-10.

## Global Constraints

- No `api_id`, `api_hash`, Bot Token, MTProto, Telethon, or GramJS.
- WebZ only: `https://web.telegram.org/k/`.
- QR / phone / 2FA are completed by the user in the visible Chromium window.
- Never log or persist QR payload, login code, 2FA password, cookies, session
  token, or proxy password.
- Profile is stored under `%LOCALAPPDATA%\UnofficialTelegramAgentConnector\profiles\<id>\chromium-user-data`.
- No profile path reaches the renderer.
- One account only in Phase 2; the profile layout must allow more later.
- All Phase 1 Electron security settings stay in place.
- Preserve the proven Phase 0 launch options; no Docker, microservice, or
  extra architecture.

## Evidence and Rulings

- **Ruling:** Phase 0's successful proxy path was an **explicit**
  `SPIKE_PROXY` passed to Playwright, not proven automatic system-proxy
  inheritance (`docs/spike/PHASE0_REPORT.md` line 67, ADR-013). The resolver
  therefore supports both, ordered manual → Phase 0 env → Windows registry →
  environment → direct, and the report must not claim system inheritance as
  proven until a live test shows it.
- **Ruling:** Existing `TASKS/02_DESKTOP_SHELL.md` and
  `TASKS/03_BROWSER_LOGIN_SESSION.md` already describe Phase 2. Extend them
  instead of creating a duplicate `02_BROWSER_MANAGER.md`.
- **Ruling:** Work continues on `main` because this is a single-developer local
  repository and the user directed Phase 2 work here; no worktree was requested.

## File Structure

```text
src/core/network/proxy-resolver.ts      source detection, validation, redaction
src/core/network/windows-proxy.ts       read WinINET proxy via reg.exe
src/core/browser/browser-types.ts       shared browser/session types
src/core/browser/profile-paths.ts       derived profile directories
src/core/browser/profile-lock.ts        app-level profile lock
src/core/browser/browser-factory.ts     Playwright persistent-context launcher
src/core/browser/browser-manager.ts     launch/close/state and crash hooks
src/core/telegram/selectors/selector-map.ts
src/core/telegram/login-detector.ts     pure visibility-based detection
src/core/telegram/navigation.ts         WebZ URL and navigation
src/core/telegram/telegram-types.ts
src/core/telegram/login-monitor.ts      polling, stability, timeout, errors
src/core/account/account-types.ts       stored metadata and public view
src/core/account/account-store.ts       atomic JSON metadata store
src/main/account-controller.ts          orchestration owned by Main
src/shared/account.ts                   renderer-safe status/view types
src/shared/ipc.ts                       new allowlisted channels and events
src/preload/index.ts                    minimal bridge for account calls
src/renderer/src/App.tsx                single-account dashboard
tests/unit/proxy-resolver.test.ts
tests/unit/profile-lock.test.ts
tests/unit/browser-manager.test.ts
tests/unit/login-detector.test.ts
tests/unit/login-monitor.test.ts
tests/unit/account-store.test.ts
tests/unit/account-controller.test.ts
tests/integration/browser.test.ts       real Chromium: profile persistence, lock
tests/integration/proxy.test.ts         local HTTP proxy and SOCKS5-free auth path
tests/e2e/app.test.ts                   updated preload surface + account IPC
```

## Tasks

### Task 1 — State files and task mapping

Write `docs/PROJECT_STATE.md`, `docs/handoff/*`, this plan, and update task
files. No product code. Commit `docs(phase2): add project state and plan`.

### Task 2 — Proxy resolver

Interfaces produced:

```ts
type ProxySource = "manual" | "phase0" | "windows" | "environment" | "direct";
interface ProxyResolution {
  source: ProxySource;
  mode: "proxy" | "direct";
  server?: string;
  bypass?: string[];
  requiresAuthentication: boolean;
}
resolveProxy(inputs: ProxyInputs): ProxyResolution
redactProxyServer(server: string): string
readWindowsProxy(): WindowsProxySettings | null
```

Rules: explicit manual (`CONNECTOR_PROXY_SERVER`) and Phase 0 (`SPIKE_PROXY`)
are authoritative — invalid values raise `PROXY_ERROR` instead of silently
going direct. Registry/env sources are best-effort. Accept `http`, `https`,
`socks5`; reject other schemes and malformed hosts. Credentials never appear in
`redactProxyServer` output. Tests cover priority, validation, bypass, auth
detection, and redaction.

### Task 3 — Profile paths and lock

`accountProfileDir`, `acquireProfileLock`, `releaseProfileLock`. A lock
belonging to a live PID is refused with `PROFILE_LOCKED`; a stale or malformed
lock is replaced. The profile directory is never deleted during recovery.

### Task 4 — Browser manager and launcher

`createPlaywrightLauncher()` lazily imports `playwright`, launches headed with
the Phase 0 args (`--no-first-run`, `--no-default-browser-check`,
`viewport: null`), and applies the proxy when present. `BrowserManager` acquires
the lock, launches, exposes the first page, reports close/crash, and releases
the lock on close or launch failure. Unit tests use a fake launcher; integration
tests use real Chromium and a local server.

### Task 5 — Telegram adapter and login monitor

Selector map keeps the Phase 0 selectors. `detectLoginState(probe)` returns
`CONNECTED` only when the chat list is visible and auth pages are not;
`LOGIN_REQUIRED` when auth/QR is visible; otherwise `UNKNOWN`.
`waitForLogin` polls (2 s), requires two consecutive `CONNECTED` results, maps
closed page to `BROWSER_CLOSED`, and a persistent `UNKNOWN` after the grace
period to `TELEGRAM_UI_CHANGED`. Unit tests use a fake probe; fixture tests use
local HTML with the real selectors.

### Task 6 — Account store and controller

`AccountStore` keeps `accounts.json` with `{ id, label, profileDir, createdAt,
lastConnectedAt }`, atomic writes, and no secrets. `AccountController` exposes
`getView`, `start`, `stop`, `openTelegram`, `remove(deleteProfile: boolean)`,
sets status transitions, resolves proxy once per start, and emits views without
profile paths. Removal deletes the profile only with explicit confirmation.

### Task 7 — IPC, preload, renderer

Channels: `account:get`, `account:start`, `account:stop`, `account:open`,
`account:remove`, plus event `account:status`. All use the existing sender
validation and result envelope. Preload exposes only those functions and one
subscription. UI shows connector/browser/login status, Add Account, Connect,
Open Telegram, Reconnect, and Remove Account (with confirmation). No path or
credential is rendered.

### Task 8 — Verification and report

Run format, typecheck, lint, unit, integration, E2E, build. Perform the live
manual test checklist (QR, 2FA, connected, browser restart, Electron restart,
Windows restart, proxy loss/recovery, revoke) or record exactly which steps the
user must perform. Write `docs/phase2/PHASE2_REPORT.md`, update state/handoff,
commit independently. Do not start Phase 3.

## Review Focus

- Live system-proxy inheritance is unproven; a user with only an OS proxy must
  see a clear `PROXY_ERROR`, not a silent direct connection.
- The lock must never let two Chromium processes share one profile.
- A closed/crashed browser must not leave a permanent `PROFILE_LOCKED` state.
- Login detection must not report `CONNECTED` while the auth page is visible.
- No profile path, proxy credential, or session data may reach the renderer,
  logs, or Git.
