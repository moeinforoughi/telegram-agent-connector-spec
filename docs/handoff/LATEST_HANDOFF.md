# Latest Handoff

## Project
Telegram Agent Connector

## Current Phase
Phase 2 — Browser Manager, Proxy Integration & Single Account Login

## Current Task
Task 7 — IPC, preload and renderer. Wiring is written in the working tree;
verification is red and nothing is committed.

## Overall Status
In Progress

## Last Verified Commit
cce43eb `feat(account): add single account store and controller`.
Tasks 1–6 of Phase 2 are committed. The Phase 2 handoff that said "Task 1
completing, Task 2 next" was stale and has been corrected here.

## Git Branch
main

## Working Tree
Modified (Task 7 wiring, uncommitted):
- `src/main/index.ts`
- `src/main/ipc-router.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`
- `src/shared/errors.ts`
- `src/shared/ipc.ts`
- `tests/e2e/app.test.ts`
- `tests/unit/ipc-router.test.ts`
- `tests/unit/ipc.test.ts`

Untracked:
- `src/main/browser-self-test.ts` — orphaned dev smoke test; imports a
  non-existent `BrowserSelfTestResult` and is imported by nothing.

## Completed Work
- Phase 0 and Phase 1 are complete and committed.
- Phase 2 Task 1 — state files and plan (`22789a8`).
- Phase 2 Task 2 — proxy resolver and Windows proxy reader (`b644d43`).
- Phase 2 Task 3 — profile paths and lock (`99da896`).
- Phase 2 Task 4 — BrowserManager, Playwright launcher, integration tests
  (`3e67eab`).
- Phase 2 Task 5 — Telegram selectors, login detector/monitor, fixtures
  (`713eb0d`).
- Phase 2 Task 6 — account store and controller (`cce43eb`).
- Repository inspection (this session): confirmed commits above, read all
  source/test/config files, ran unit/integration/E2E/typecheck/lint/format.

## Current Work
Task 7 is implemented but unverified:
- Account IPC channels `account:get|start|stop|open|remove`, event
  `account:status`, payload validation for `account:remove`, sender validation.
- Preload exposes only the six functions plus `onAccountStatus`.
- Renderer dashboard: status, Add Account / Connect / Open Telegram /
  Disconnect / Remove Account (confirm dialog), error display, no paths.
- Main wires `AccountController`, `BrowserManager`, `AccountStore`,
  `resolveSystemProxy`, and stops the browser before quit.
- The version of `account-controller.ts` in `cce43eb` refers to
  `handleBrowserClosed`, which exists.

## Changed Files (Task 7 details)
- `src/shared/ipc.ts` — new channels/event, `RemoveAccountRequest`, expanded
  `ConnectorApi`.
- `src/shared/errors.ts` — adds `INVALID_ARGUMENT`.
- `src/main/ipc-router.ts` — typed handler map, per-channel dispatch,
  `sendAccountStatus`, remove payload validation.
- `src/main/index.ts` — controller creation, IPC registration, quit handling.
- `src/preload/index.ts` — bridge for account functions and status event.
- `src/renderer/src/App.tsx` / `styles.css` — single-account dashboard.
- `tests/e2e/app.test.ts` — dashboard test, expanded preload assertion,
  Playwright-in-main smoke test (currently failing), browsers path fallback.
- `tests/unit/ipc-router.test.ts`, `tests/unit/ipc.test.ts` — updated for the
  new channels.

## Test Results (2026-11-10, this session)

Environment used:

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue   # required for E2E
```

- `npx vitest run tests/unit` — **PASS**, 17 files / 103 tests.
- `npx vitest run tests/integration` — **PASS**, 2 files / 9 tests (real
  Chromium).
- `npx vitest run tests/e2e` — **7/8 PASS**. Failure:
  `loads Playwright and launches a browser from the Electron main process` →
  `electronApplication.evaluate: TypeError: A dynamic import callback was not
  specified.` Root cause: dynamic `import()` cannot run inside
  `app.evaluate`.
- `npx tsc --noEmit` — **FAIL**, 1 error:
  `src/main/browser-self-test.ts(5,15): Module '../shared/ipc' has no exported
  member 'BrowserSelfTestResult'`.
- `npx eslint .` — **FAIL**, 1 error: `tests/e2e/app.test.ts:144`
  `import()` type annotations are forbidden
  (`@typescript-eslint/consistent-type-imports`).
- `npx prettier --check .` — **FAIL**: `src/renderer/src/App.tsx`,
  `tests/e2e/app.test.ts`, `tests/unit/ipc-router.test.ts`.
- `npm run build` — succeeds (run as part of `npm run test:e2e`).

## Architecture Decisions
- D-001 WebZ `/k/`.
- D-003 pinned stack.
- D-006 System Proxy First + Manual Fallback.
- Phase 0 proxy was explicit, not system-inherited; resolver supports both and
  the report must say which was actually verified.
- Task 7 keeps renderer path-free: `AccountView` has no profile dir.

## Known Issues
- Orphan `src/main/browser-self-test.ts` breaks typecheck. Decision pending:
  delete it (recommended) or adopt it behind a test-only path.
- E2E Playwright-in-main test needs a working way to load Playwright inside the
  Electron main process without dynamic `import()` in `app.evaluate`.
  A verified probe: `process.mainModule.require(app.getAppPath() +
  '/node_modules/playwright')` launches Chromium from Main in this stack.
- `ELECTRON_RUN_AS_NODE=1` in the DSH shell breaks Playwright Electron launch
  (`bad option: --remote-debugging-port=0`). Unset it before E2E.
- Playwright Chromium for the root package lives in `spike/.browsers`; set
  `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers`.
- Playwright must remain a runtime dependency so electron-vite externalizes it.
- Chromium bundling with the app is Phase 6; Phase 2 only verifies the dev path.

## Blockers
None for automated work, except the pending decision on the orphan file.
Live QR/2FA/session tests require the user and a real Telegram account.

## Remaining Work
- Task 7: resolve the orphan file, fix the E2E self-test, format, get
  typecheck/lint/format/unit/integration/E2E green, commit.
- Task 8: full verification, Phase 2 report, live manual checklist
  (QR, 2FA, connected, browser restart, Electron restart, Windows restart,
  proxy loss/recovery, revoke).
- Do not start Phase 3 without explicit approval.

## Exact Next Action
1. Ask the user how to handle `src/main/browser-self-test.ts` (delete vs adopt).
2. Fix the E2E smoke test (use an absolute `process.mainModule.require` from the
   app path, or the adopted self-test helper).
3. Run `npx prettier --write` on the three files, then re-run typecheck, lint,
   format:check, unit, integration, E2E.
4. Update this handoff and `docs/handoff/SESSION_LOG.md`, then commit Task 7.

## Resume Instructions
Read `AGENTS.md`, `docs/PROJECT_STATE.md`, this file,
`docs/handoff/SESSION_LOG.md`, `docs/handoff/RESUME_PROMPT.md`, then
`docs/phase2/PHASE2_PLAN.md`. Check `git status`, `git log -8`, `git diff`.
Tasks 1–6 are committed; never redo them. Task 7 is uncommitted in the working
tree; do not delete or overwrite it without reading the diff first.
