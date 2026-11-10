# Phase 3 — Multi-account Final Report

Status: **COMPLETE FOR MVP**.
Date: 2026-11-10
Branch: `main`
Implementation commit: `d1107bc`
Browser-close readiness fix: `7ed25a2`
Duplicate-submit guard: `e3ffc6e`
Plan: `docs/phase3/PHASE3_PLAN.md`

## 1. Scope

Manage multiple Telegram accounts, each with an independent Chromium profile,
session, and browser runtime. Browsers are launched lazily, capped at three
active, and per-account lifecycle operations are serialized.

Phase 4 (Telegram operations) and MCP are not part of this phase.

## 2. Architecture

- `AccountStore` is the registry (`config/accounts.json`): list/get/create/
  rename/remove, UUID ids, labels, managed profile paths, atomic writes, corrupt
  registry backup and recovery.
- `AccountController` owns exactly one account (`accountId`): login state
  machine, manual proxy, retry-after-network-error, browser preservation.
- `AccountManager` owns one lazy runtime per account (`AccountController` +
  `BrowserManager`/Playwright context), enforces the active-browser limit (3),
  serializes same-account starts, isolates views, and removes profiles only with
  explicit confirmation.
- IPC/preload: 11 channels, account-id payload validation, path-free views.
- Renderer: account list/cards, Add/Rename/Connect/Reconnect/Open/Disconnect/
  Remove, global manual proxy card.

See ADR-022 and `docs/architecture/IMPLEMENTED_ARCHITECTURE.md` §6.

## 3. Automated verification (2026-11-10, `e3ffc6e`)

`npm run check` — **PASS (exit 0)**:

| Stage | Result |
|---|---|
| Typecheck | PASS |
| Lint | PASS |
| Format | PASS |
| Unit | 19 files / 118 tests PASS |
| Integration | 2 files / 13 tests PASS (real Chromium) |
| Build | PASS |
| Electron E2E | 13 tests PASS |

Coverage includes three registry entries, isolated profiles, lazy launch, max
active browsers, same-account serialization, account isolation on browser close,
remove with/without profile deletion, corrupt-registry recovery, and path
traversal rejection.

## 4. Live multi-account results (2026-11-10, user-run)

Only labels are recorded; no phone number, identity data, cookie, token, or
profile path is stored in the repository.

| Item | Result |
|---|---|
| Accounts created | Two: `moein1`, `kaonashi` |
| Proxy used | SOCKS5 `127.0.0.1:12334` |
| Browser launched per account | **PASS** (both) |
| Login reached Connected | **PASS** (both) |
| Browser closed by user | Both closed |
| Accounts removed | None |
| Profiles retained | Two profile directories remain |
| Session preserved after browser close | Yes (user confirmed) |

Automated coverage creates three accounts; the live run used two real accounts.
The third live account is **NOT TESTED** and is accepted for MVP. The two
existing profiles/sessions are preserved for Phase 4 and must not be deleted,
reset, removed, or copied into Git.

## 5. Browser close semantics fix (`7ed25a2`)

Before: closing the Chromium window produced `Status: Error`, `BROWSER_CLOSED`.
After: a normal user close produces:

```text
Account Status: Ready
Browser: Closed
Login: Last known Connected
```

- `ready` is a new account status; it is not an error.
- The last known `loginState` is kept; the profile-backed session is not reset.
- Reconnect relaunches the same profile and reuses the stored session.
- Closing one account's browser leaves the other account untouched.
- Profile files are never deleted on close.
- `BROWSER_CLOSED` from the login monitor is mapped to the same ready transition,
  so a user close does not produce an error view.
- Crash detection is intentionally out of scope; a real crash is still only
  logged.

## 6. Known limitations

- Crash vs normal close is not distinguished beyond the ready transition.
- Remove during an in-flight start can race with stop/relaunch; not covered by a
  test yet.
- The manual proxy is global for all accounts; per-account proxy is out of scope.
- At most three active Chromium instances.
- Chromium packaging remains Phase 6.

## 7. Phase 3 exit criteria

| Criterion | Status |
|---|---|
| Multi-account registry | PASS |
| Independent profile/session per account | PASS (automated + live) |
| Lazy browser launch | PASS |
| Max active browser limit | PASS |
| Same-account serialization | PASS |
| One account's browser close does not affect another | PASS (unit) |
| Remove requires explicit confirmation | PASS |
| Corrupt registry recovery | PASS |
| Path traversal prevention | PASS |
| Automated tests | PASS (`e3ffc6e`) |
| Live real-account test | PASS with two accounts; third accepted as not tested |
| Sessions preserved for Phase 4 | Yes — do not touch |

**Conclusion: Phase 3 is COMPLETE FOR MVP.** Phase 4 may start only with explicit
approval; its plan is `docs/phase4/PHASE4_PLAN.md`.
