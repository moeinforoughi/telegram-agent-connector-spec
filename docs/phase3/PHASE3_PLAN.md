# Phase 3 — Multi-account Management

Status: **COMPLETE FOR MVP** — two live accounts PASS; third live account
accepted as not tested. Final report: `docs/phase3/PHASE3_REPORT.md`.
Start: 2026-11-10
Depends on: Phase 2 (COMPLETE FOR MVP)
Scope source: `TASKS/04_MULTI_ACCOUNT.md`, `ROADMAP.md`, `ARCHITECTURE.md`

## Goal

Manage at least three real Telegram accounts, each with its own Chromium
profile, session, and browser runtime. One account must never share cookies,
storage, or a browser context with another. Account creation is lazy: starting
the app must not launch every browser.

Out of scope: MCP, Telegram operations (messages/chats), per-account proxy
settings, remote browser, packaging. Phase 4+ must not start.

## Invariants

- One profile per account, derived from the account UUID, never from free user
  input.
- One active browser context per profile, guarded by the existing app-level
  profile lock.
- Per-account operations are serialized; one account cannot block another.
- Browsers are lazy-started and limited to a small maximum (default 3).
- Removing an account deletes its profile only with explicit confirmation.
- Manual proxy configuration stays global and unchanged (ADR-020).
- No `api_id`, `api_hash`, Bot Token, MTProto, Telethon, or GramJS.
- Existing Electron security, IPC allowlist, sender validation, and CSP stay.

## Data model

`config/accounts.json` remains the registry:

```ts
type StoredAccount = {
  id: string;              // UUID, immutable
  label: string;           // user-editable, non-unique is allowed
  profileDir: string;      // profiles/<id>/chromium-user-data
  createdAt: string;
  lastConnectedAt?: string;
};
```

`AccountView` (renderer-safe) per account:

```ts
type AccountView = {
  id: string;
  label: string;
  status: "disconnected" | "initializing" | "waiting_for_login" |
          "authenticating" | "connected" | "error";
  loginState?: LoginState;
  error?: SerializedError;
  createdAt?: string;
  lastConnectedAt?: string;
};
```

No profile path, proxy credential, cookie, or session token reaches the
renderer.

## Runtime architecture

```
AccountManager (Main)
  ├─ AccountStore (registry)
  ├─ ProxySettingsStore (global manual proxy)
  └─ Map<accountId, AccountRuntime>
        ├─ AccountController (per account, serialized)
        └─ BrowserManager + Playwright launcher (per account)
```

- `AccountManager` is the only owner of account lifecycle.
- A runtime is created lazily on the first `start`/`open` for that account.
- `list` never launches a browser.
- Active browser count is checked before a launch; exceeding the limit returns
  `BROWSER_LIMIT_REACHED` (new fixed error code) without touching other
  accounts.
- `remove` stops that account's runtime, removes metadata, and deletes the
  profile directory only when `deleteProfile === true`.
- A corrupt registry is backed up (renamed) and treated as empty; the previous
  file is never deleted.
- Stale profile locks are recovered by the existing `profile-lock` logic; the
  profile is never deleted during recovery.

## IPC / preload (Phase 3 surface)

| Channel | Payload | Result |
|---|---|---|
| `account:list` | none | `AccountView[]` |
| `account:create` | `{ label?: string }` | `AccountView` |
| `account:rename` | `{ id, label }` | `AccountView` |
| `account:start` | `{ id }` | `AccountView` |
| `account:stop` | `{ id }` | `AccountView` |
| `account:open` | `{ id }` | `AccountView` |
| `account:remove` | `{ id, deleteProfile }` | `{ removed: true }` |

Event `account:status` carries one `AccountView` for the changed account.
Every payload is validated; unknown ids return `ACCOUNT_NOT_FOUND`.

## Renderer

- Account list with label, status, login state, last connected time.
- Add Account: creates a labelled account and optionally opens it.
- Per-account Connect/Reconnect, Open Telegram, Disconnect, Remove.
- Remove asks for confirmation before deleting the profile.
- No paths or credentials are rendered.
- Manual proxy card stays global and unchanged.

## Tasks

### Task 1 — Phase 3 plan and state
Write this plan, map `TASKS/04`, and record Phase 2 closure. No product code.

### Task 2 — Account registry API
Extend `AccountStore` with `list`, `getById`, `rename`, and corrupt-registry
recovery (backup + empty). Keep atomic writes and path validation. Tests:
create three, list order, rename, remove, corrupt recovery, path traversal,
profile isolation.

### Task 3 — Per-account controller
Refactor `AccountController` to operate on a fixed `accountId` and stop owning
account creation/removal. Keep status machine, proxy application, browser
preservation, and per-instance serialization. Tests updated.

### Task 4 — AccountManager
Implement lazy runtimes, max active browser limit, list/start/stop/open/remove,
view fan-out, and shutdown. Unit tests with fake browsers: three accounts,
isolation, limit, reentrant start, remove one without affecting others.

### Task 5 — IPC, preload, renderer
Replace the single-account channels with the Phase 3 surface, update preload and
the dashboard, keep validation and path-free views. Unit/E2E tests.

### Task 6 — Verification and report
Run typecheck, lint, format, unit, integration, E2E, build, and `npm run check`.
Write `docs/phase3/PHASE3_REPORT.md`; update state/handoff. Do not start Phase 4.

## Definition of Done

- At least three accounts can be created and listed.
- Each account has an isolated profile/session and a separate browser context.
- Browsers are lazy and capped by the max-active limit.
- One account's start/stop/error does not change another account's view.
- Remove deletes the profile only after explicit confirmation.
- Corrupt registry recovery keeps a backup and starts empty.
- Path traversal is rejected.
- Concurrent same-account starts are serialized.
- Typecheck, lint, format, unit, integration, E2E and `npm run check` pass.
- Docs and handoff updated; every task committed independently.

## Status (2026-11-10)

| Task | Status |
|---|---|
| 1 — Plan/state | Done (`51d4ccc`) |
| 2 — Registry API | Done: list/get/rename/recovery/path validation |
| 3 — Per-account controller | Done: fixed `accountId`, no create/remove |
| 4 — AccountManager | Done: lazy runtimes, max 3, isolation, shutdown |
| 5 — IPC/preload/renderer | Done: 11 channels, multi-account dashboard |
| 6 — Verification/report | Done: 118 unit, 13 integration, 13 E2E; two live accounts PASS; report written (`docs/phase3/PHASE3_REPORT.md`) |

Implementation commit: `d1107bc`; browser-close readiness fix: `7ed25a2`.

## Risks and decisions

- The global proxy applies to all accounts in Phase 3; per-account proxy is out
  of scope.
- Browser close reason is still not modelled (Phase 2 known gap); not a Phase 3
  blocker.
- Three simultaneous Chromium instances are resource-heavy; the default limit is
  3 and can be lowered in tests.
- `AccountView` keeps the same fields as Phase 2 so the renderer can evolve
  without leaking paths.
