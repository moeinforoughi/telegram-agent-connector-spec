# Latest Handoff

## Project
Telegram Agent Connector

## Current Phase
Phase 2 — Browser Manager, Proxy Integration & Single Account Login

## Current Task
Task 8 — verification and Phase 2 report. In progress: the permanent
Session-Independent Development rules were added to `AGENTS.md`; next is the
architecture audit, then automated verification, then the live checklist.
Task 7 is complete and committed as `07f20d9`.

## Overall Status
In Progress

## Last Verified Commit
`0ac40fe` (governance docs). The last code commit is `07f20d9`, which passed
full `npm run check` before commit; the tree at `07f20d9` was re-verified after
the Task 7 docs commit.

## Git Branch
main

## Working Tree
Clean at `0ac40fe`. This checkpoint adds the architecture audit documents:
`docs/architecture/IMPLEMENTED_ARCHITECTURE.md`, ADR-015…019 in
`ARCHITECTURE_DECISIONS.md`, and a target-vs-implemented banner in
`ARCHITECTURE.md`.

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
- Phase 2 Task 7 — account IPC, preload bridge, single-account dashboard
  (`07f20d9`):
  - Channels `account:get|start|stop|open|remove`; event `account:status`;
    sender validation and a validated `account:remove` payload.
  - Preload exposes only the six functions plus `onAccountStatus`.
  - Dashboard shows connector/browser/login status and Add Account, Connect,
    Open Telegram, Disconnect, Remove Account (native confirm), with no paths
    or credentials.
  - Main wires `AccountController`, `BrowserManager`, `AccountStore`,
    `resolveSystemProxy`, and closes the browser before quit.
  - Removed the abandoned untracked `src/main/browser-self-test.ts` (dead code
    with a missing type, imported by nothing) with explicit user approval.
  - Fixed the E2E Playwright-in-main test: `app.evaluate` cannot use dynamic
    `import()`, so the test requires Playwright from
    `<appPath>/node_modules/playwright` through the Electron main module.
- Task 8 governance step — Session-Independent Development is now a permanent
  rule in `AGENTS.md` (pre-session checks, per-task recording, end-of-session
  checklist, Source of Truth, mandatory handoff content); commit `0ac40fe`.
- Task 8 architecture audit — implemented architecture documented, ADR-015…019
  added for the real decisions (Playwright runtime dependency/lazy import,
  account IPC model, profile lock, proxy resolution order, E2E Playwright
  loading), and the target `ARCHITECTURE.md` now points to the audit.

## Test Results (2026-11-10, before commit `07f20d9`)

Environment used:

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue   # required for E2E
```

- `npm run check` — **PASS** (exit 0). It runs:
  - `tsc --noEmit` — pass.
  - `eslint .` — pass.
  - `prettier --check .` — pass.
  - `vitest run tests/unit` — 17 files / 103 tests pass.
  - `vitest run tests/integration` — 2 files / 9 tests pass (real Chromium).
  - `npm run build` + `vitest run tests/e2e` — 8 tests pass.

The E2E `loads Playwright and launches a browser from the Electron main process`
test passes in 717 ms.

## Architecture Decisions
- D-001 WebZ `/k/`.
- D-003 pinned stack.
- D-006 System Proxy First + Manual Fallback.
- Phase 0 proxy was explicit, not system-inherited; resolver supports both and
  the report must say which was actually verified.
- Task 7 keeps the renderer path-free: `AccountView` has no profile dir.
- The E2E self-test loads Playwright by absolute path from the app root instead
  of adding a self-test IPC channel, keeping the preload surface minimal.

## Known Issues
- `ELECTRON_RUN_AS_NODE=1` in the DSH shell breaks Playwright Electron launch
  (`bad option: --remote-debugging-port=0`). Unset it before E2E.
- Playwright Chromium for the root package lives in `spike/.browsers`; set
  `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers`.
- Live system-proxy inheritance is still unproven; only the explicit proxy path
  was verified in Phase 0.
- No live QR/2FA/restart test has been run for Phase 2 yet.
- The renderer Remove Account confirmation uses `window.confirm`; it is not
  covered by an automated test because the flow would start a real browser.
- Playwright must remain a runtime dependency so electron-vite externalizes it.

## Blockers
None for automated work. Task 8's live checklist needs the user and a real
Telegram account.

## Remaining Work
- Task 8: run the full verification, perform the live manual checklist
  (QR, 2FA, connected, browser restart, Electron restart, Windows restart,
  proxy loss/recovery, revoke) or record exactly which steps the user must run,
  then write `docs/phase2/PHASE2_REPORT.md`, update state/handoff, and commit.
- Do not start Phase 3 without explicit approval.

## Exact Next Action
Run the automated Task 8 verification: sanitize `ELECTRON_RUN_AS_NODE` in the
E2E launcher, add the proxy-loss/recovery integration test, run `npm run check`,
then write `docs/phase2/PHASE2_REPORT.md` and the live manual checklist.
Phase 3 is not authorized.

## Resume Instructions
Read `AGENTS.md`, `docs/PROJECT_STATE.md`, this file,
`docs/handoff/SESSION_LOG.md`, `docs/handoff/RESUME_PROMPT.md`, then
`docs/phase2/PHASE2_PLAN.md`. Check `git status`, `git log -8`, `git diff`.
Tasks 1–7 are committed; never redo them. None of the Phase 2 product code is
uncommitted.
