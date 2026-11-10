# Session Log (append-only)

## 2026-11-10 — Phase 0 and Phase 1 (historical)

- Phase 0 feasibility spike completed and approved; evidence in
  `spike/logs/spike-state.jsonl` and `docs/spike/PHASE0_REPORT.md`.
- Phase 1 Electron foundation completed: secure Main/Preload/Renderer split,
  allowlisted IPC, data paths, tests, build, docs.
- Commits: `4219476`, `8e25b57`, `619c095`.
- Verification: 28 unit + 6 E2E, typecheck, lint, format, build all passed.

## 2026-11-10 — Phase 2 session start

- Phase and task: Phase 2, Task 1 (state/plan) and repository inspection.
- Completed:
  - Read `AGENTS.md`, Phase 0 report, Phase 1 report, existing tasks 02/03,
    spike source (`browser.ts`, `config.ts`, `telegram.ts`, `login.ts`,
    `verify.ts`, `navigation.ts`).
  - Confirmed Phase 0 proxy was explicit `SPIKE_PROXY`; Windows `ProxyEnable`
    was `0` and no proxy env vars were set at inspection time.
  - Confirmed existing tasks already cover Phase 2; no duplicate task file.
  - Confirmed Playwright Chromium is in `spike/.browsers`, not the default cache.
  - Added `docs/PROJECT_STATE.md`, `docs/handoff/*`,
    `docs/phase2/PHASE2_PLAN.md`.
- Tests run: none for Phase 2 yet (Phase 1 suite was green at start).
- Commits: pending.
- Issues/decisions:
  - System proxy inheritance is unproven; resolver must support explicit and
    registry sources and never silently go direct for an invalid explicit proxy.
  - Work continues on `main` at the user's direction; no worktree.

## 2026-11-10 — Phase 2 session 2 (state reconciliation)

- Read `AGENTS.md`, `docs/PROJECT_STATE.md`, handoff files, and
  `docs/phase2/PHASE2_PLAN.md`.
- Found the handoff badly stale: it described Task 1/2, while the repository
  already contained committed Tasks 2–6 (`b644d43`, `99da896`, `3e67eab`,
  `713eb0d`, `cce43eb`) and uncommitted Task 7 wiring.
- Updated `docs/PROJECT_STATE.md`, `docs/handoff/LATEST_HANDOFF.md`, and
  `docs/handoff/RESUME_PROMPT.md` to match the real tree.
- Tests run:
  - `npx vitest run tests/unit` → 103/103 pass.
  - `npx vitest run tests/integration` → 9/9 pass (real Chromium).
  - `npx vitest run tests/e2e` → 7/8 pass; Playwright-in-main test fails with
    "A dynamic import callback was not specified" inside `app.evaluate`.
  - `npx tsc --noEmit` → fails on orphan `src/main/browser-self-test.ts`.
  - `npx eslint .` → one error in `tests/e2e/app.test.ts`.
  - `npx prettier --check .` → three files unformatted.
- Environment finding: `ELECTRON_RUN_AS_NODE=1` in the DSH shell makes
  Playwright Electron launch fail with `bad option: --remote-debugging-port=0`;
  unsetting it makes E2E launch again. Recorded in `RESUME_PROMPT.md`.
- Decision pending from the user: delete the orphan `browser-self-test.ts`
  (recommended) or adopt it behind a test-only path.
- No product code changed in this session yet; no commit made by this session.

## 2026-11-10 — Phase 2 Task 7 completion

- User approved: delete the orphan file and complete Task 7 only (no Phase 3).
- Deleted untracked `src/main/browser-self-test.ts` after confirming it had no
  project references. No self-test IPC channel was added; the preload surface
  stays minimal.
- Fixed the E2E Playwright-in-main test: `app.evaluate` cannot use dynamic
  `import()`, so the test requires
  `<appPath>/node_modules/playwright` through `process.mainModule`.
- Ran `prettier --write` on the three unformatted files.
- Verification (with `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers` and
  `ELECTRON_RUN_AS_NODE` unset):
  - `npx tsc --noEmit` → PASS.
  - `npx eslint .` → PASS.
  - `npx prettier --check .` → PASS.
  - `npx vitest run tests/unit` → 103/103 PASS.
  - `npx vitest run tests/integration` → 9/9 PASS (real Chromium).
  - `npm run test:e2e` → 8/8 PASS (build included).
  - `npm run check` → PASS (exit 0).
- Secret/temp review of the diff: no secrets, profiles, browser data, logs, or
  temporary files.
- Commit `07f20d9` — `feat(account): wire single-account ipc, preload and
  dashboard` (10 files, +481/−77).
- Next: Task 8 (verification + Phase 2 report + live manual checklist) awaits
  explicit user approval. No Phase 3 work started.

## 2026-11-10 — Phase 2 Task 8 governance step

- User authorized Task 8 plus a permanent governance update; Phase 3 remains
  forbidden.
- Verified repository truth: `main` at `bcfda54`, working tree clean, commits
  `7c51c03`, `07f20d9`, `bcfda54` present and in order.
- Added the permanent Session-Independent Development rules to `AGENTS.md`:
  pre-session reading/Git checks, per-task recording, end-of-session handoff
  checklist, Source of Truth rule, and the state-file references.
- Extended Definition of Done to require updated state/handoff files.
- Updated `docs/PROJECT_STATE.md`, `LATEST_HANDOFF.md` and `RESUME_PROMPT.md`
  for the new governance stage.
- No product code changed in this step; commit hash recorded in the next
  handoff update.

## 2026-11-10 — Phase 2 architecture audit

- Commit `0ac40fe` recorded the Session-Independent Development rules and
  governance state updates.
- Audited Phase 0 through Phase 2 Task 7 against `ARCHITECTURE.md` and
  `ARCHITECTURE_DECISIONS.md`; checked every source file, build/test config, and
  the three recent commits.
- Added `docs/architecture/IMPLEMENTED_ARCHITECTURE.md`: runtime topology,
  component map, Electron/preload/IPC security, BrowserManager + profile
  layout/lock, Telegram selectors/login monitor, account store/controller, proxy
  resolution and Windows registry reader, test architecture, divergences with
  reasons and limits, verified security invariants, environment facts.
- Added ADR-015 (Playwright runtime dependency + lazy import), ADR-016 (account
  IPC model and path-free view), ADR-017 (app-level profile lock), ADR-018
  (proxy resolution order/validation/redaction), ADR-019 (E2E Playwright loading
  and environment sanitization).
- Marked `ARCHITECTURE.md` as the target design and pointed it to the
  implemented-architecture document; corrected the start URL to `/k/`.
- Recorded these findings for Task 8: `ELECTRON_RUN_AS_NODE` is inherited from
  the DSH shell only (not User/Machine), `spike/.browsers` matches Playwright's
  pinned Chromium revision 1254, and the default Playwright cache is absent.
- No product code changed in this step.

## 2026-11-10 — Phase 2 Task 8 automated verification

- Commit `0ac40fe` — session-independent development workflow.
- Commit `9c2d0d2` — implemented architecture audit and ADR-015…019.
- Commit `582c01a` — Task 8 automated verification:
  - E2E `launchEnv` now strips `ELECTRON_RUN_AS_NODE`, so the Electron child
    boots as Electron regardless of the agent shell.
  - New integration test: stale lock is replaced and the profile is preserved.
  - New integration test: navigation fails while the local proxy is down and
    recovers after the proxy returns.
- Verification on `582c01a` with `ELECTRON_RUN_AS_NODE=1` still exported:
  - `npm run check` → PASS (exit 0).
  - Typecheck, lint, format:check → PASS.
  - Unit 103/103 PASS; integration 11/11 PASS (real Chromium); E2E 8/8 PASS;
    build PASS.
- Task 7 review: IPC surface, preload minimality, renderer isolation, sender and
  payload validation, dashboard flow, and metadata handling all verified.
  `process.mainModule` is test-only and deprecated; documented in ADR-019.
- Wrote `docs/phase2/PHASE2_REPORT.md` with the automated evidence matrix, Task 7
  review, environment findings, the 16-step live checklist, Phase 2 exit
  criteria, and known limitations.
- Updated architecture test counts and the `ELECTRON_RUN_AS_NODE` handling note.
- Phase 2 is **Partially Verified**: live QR/2FA/session/restart/proxy steps are
  Pending and must be run by the user. No Phase 3 work started.
- Final documentation commit hash: see `git log -1` (this entry is committed
  with it).

## 2026-11-10 — Phase 2 final proxy fix (manual configuration)

- User reported `starting browser (direct/direct)` followed by `NETWORK_ERROR`:
  Windows System Proxy was not configured, but V2RayN (`127.0.0.1:10808`) and
  Hiddify (`127.0.0.1:12334`) were running locally.
- Replaced automatic system-proxy detection with a general manual configuration:
  - Deleted `proxy-resolver.ts` and `windows-proxy.ts`; added a small
    `proxy-server.ts` parser.
  - Added `proxy-settings.ts` (validation, atomic `config/proxy.json`,
    safeStorage-encrypted credentials, no plaintext, no persistence when OS
    encryption is unavailable).
  - Added `proxy-probe.ts` (real HTTP CONNECT / SOCKS5 CONNECT tunnel to
    `web.telegram.org:443`; distinguishes refused/timeout/auth/unavailable/
    invalid).
  - Added `proxy:get|save|test` IPC, preload methods and the Network/Proxy UI.
  - `AccountController` now applies the manual proxy through Playwright's
    `proxy` option and keeps the browser/profile/session after navigation
    errors; Retry reuses the same context; relaunch only on proxy change or
    closed page.
- Added ADR-020 (manual proxy, supersedes ADR-013/018) and ADR-021 (browser
  preservation); revised D-006.
- Removed the obsolete unit tests for the deleted resolver/registry reader and
  added parser/settings/probe/controller tests.
- Verification: `npm run check` PASS (exit 0) — 106 unit, 12 integration (real
  Chromium), 10 Electron E2E, build, typecheck, lint, format.
- Real environment: probe reached Telegram through both local proxies;
  Chromium loaded `https://web.telegram.org/k/` with HTTP 200 through
  `socks5://127.0.0.1:10808`.
- Commit `67cb669` (code + tests). Documentation commit follows with this entry;
  check `git log -1`.
- Phase 2 remains **Partially Verified**: real QR/2FA/session/restart and app
  proxy-loss checks are Pending user execution. No Phase 3 work started.

## 2026-11-10 — Saved proxy not applied to browser (fix)

- User saw `[account] starting browser (direct)` + `NETWORK_ERROR` while the UI
  showed the proxy enabled. Real
  `%LOCALAPPDATA%\UnofficialTelegramAgentConnector\config\proxy.json` contained
  `"enabled": false`.
- Confirmed the controller → `toPlaywrightProxyConfig` →
  `launchPersistentContext` path is correct; the flag was never persisted as
  true. The UI only saved on explicit Save, and the initial async settings read
  could overwrite a toggle made before it resolved.
- Fixes in `51714cf`:
  - Enable toggle persists immediately; initial load cannot overwrite edited
    form state.
  - Controller logs `proxy.enabled`, protocol, host, port, mode (no
    credentials); fail-closed if enabled but unusable.
  - BrowserManager logs `context closed`; navigation errors still keep the
    browser/profile/session for Retry.
  - `safeStorage` moved to the async API; deprecation warning removed.
  - New E2E (toggle auto-persist), integration (saved settings → Playwright →
    persistent Chromium) and unit (log metadata, fail-closed) tests.
- Verification on `51714cf`: `npm run check` PASS — 108 unit, 13 integration,
  11 E2E, build, typecheck, lint, format; no safeStorage deprecation warning.
- The existing `proxy.json` on this machine is still `enabled:false`; the user
  must enable it once more (it now writes immediately) and rerun the live
  checklist.
- Documentation commit follows with this entry; check `git log -1`.
- Phase 2 remains **Partially Verified**; no Phase 3 work started.

## 2026-11-10 — Phase 2 live manual results

- User ran the app on Windows with a real Telegram account.
- **PASS:** real Telegram login (dashboard Connected), browser close/reopen, and
  session persistence across browser restart (no new QR/login).
- Successful proxy: **SOCKS5 `127.0.0.1:12334` (Hiddify)**, confirmed by the
  persisted `config/proxy.json` at test time.
- 10808 attempts produced `PROXY_ERROR`. Post-test checks show 10808 accepts a
  TCP tunnel to `web.telegram.org:443`, but a fresh Chromium navigation through
  10808 fails while 12334 returns HTTP 200. The error meant Telegram was
  unreachable through that proxy route, not a closed port; no direct fallback
  occurred.
- `TELEGRAM_UI_CHANGED` occurred during an earlier attempt (from
  `openTelegram`'s URL check or the login monitor's UNKNOWN grace period). The
  exact branch is not recoverable because logs are console-only; the final
  attempt reached `/k/` and Connected.
- Login method (QR vs phone) and 2FA were not recorded; they are **not** marked
  PASS.
- Pending: Electron full restart, Windows full restart, proxy loss/recovery,
  session revoke detection.
- Evidence caveat: `config/proxy.json` holds 12334, but `accounts.json` is `[]`
  and `profiles/` is empty now, so the test profile is not in the default data
  directory (removed or a different `CONNECTOR_USER_DATA_DIR`). PASS results are
  user-confirmed.
- No code changed in this step; documentation commit follows. Phase 2 remains
  Partially Verified; no Phase 3 work started.

## 2026-11-10 — Phase 2 closure and Phase 3 start

- User accepted the Phase 2 MVP scope: real Telegram login, Connected status,
  browser close/reopen, and session persistence across browser restart all PASS;
  successful proxy SOCKS5 `127.0.0.1:12334`.
- Deferred and recorded as **NOT TESTED** (not failures): Electron full restart
  (user cleared the session first, so missing profile/metadata is expected),
  Windows full restart, proxy loss/recovery, session revoke, and V2RayN 10808
  troubleshooting. QR-vs-phone and 2FA remain unrecorded/unconfirmed.
- Phase 2 marked **COMPLETE FOR MVP — ACCEPTED DEFERRED VERIFICATIONS** in
  `PHASE2_REPORT.md` §9.1. No test was marked PASS without real evidence.
- Manual Proxy Configuration remains the architecture; the 12334 values are user
  settings, not a vendor integration.
- Phase 3 (Multi-account Management) started from `TASKS/04_MULTI_ACCOUNT.md`.
- No product code changed in this step; documentation commit follows. Check
  `git log -1`.
