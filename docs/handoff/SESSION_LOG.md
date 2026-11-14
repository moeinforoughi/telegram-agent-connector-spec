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

## 2026-11-10 — Phase 3 live results, browser-close fix, closure

- User ran two real accounts: `moein1`, `kaonashi`; both launched Chromium
  through SOCKS5 `127.0.0.1:12334`, both reached Connected, both browsers were
  closed, no account was removed, and both profiles/sessions were preserved for
  Phase 4. A third live account was not tested (accepted for MVP).
- Browser close semantics fixed in `7ed25a2`:
  - Normal user close → status `ready`, not error.
  - `loginState` kept as last known; profile/session untouched.
  - Reconnect reuses the same profile.
  - Closing one account does not affect another.
- Tests: 118 unit, 13 integration, 13 E2E; `npm run check` PASS.
- Wrote `docs/phase3/PHASE3_REPORT.md` and marked Phase 3 **COMPLETE FOR MVP**.
- Wrote `docs/phase4/PHASE4_PLAN.md` for Telegram Operations: read-only first,
  two preserved sessions, per-account queue, send/reply only with explicit
  approval, MCP stays Phase 5.
- No account/profile/session was deleted or modified. No real message was sent.
- Documentation commit follows; check `git log -1`. Phase 4 is not started.

## 2026-11-10 — Phase 3 final guard

- Added a duplicate-submit guard for Add Account after a flaky E2E run
  (`e3ffc6e`); a rapid double click can no longer create two accounts with the
  same label.
- `npm run check` PASS: 118 unit, 13 integration, 13 E2E.
- Documentation commit follows; Phase 3 remains COMPLETE FOR MVP and Phase 4
  remains planned/not started.

## 2026-11-10 — Phase 4 Task 1: read-only DOM/selector audit

- User approved Phase 4 and limited this step to Task 1 (read-only).
- Audited the real WebZ DOM with both preserved sessions (`moein1`,
  `kaonashi`) through SOCKS5 `127.0.0.1:12334`; no message was sent/edited/
  deleted. Only structure, classes, roles and attribute names were inspected.
- Confirmed selectors for main shell, chat list, search, open chat, header,
  messages/direction, channel posts, loading and empty state.
- Added `src/core/telegram/chat-surface.ts` and extended `selector-map.ts`.
- Added synthetic fixtures, 11 unit tests and 7 real-Chromium integration tests.
- Real smoke: both sessions `ready` (11 and 12 chat rows); one opened chat typed
  `user` with 30 messages (30 incoming, 0 outgoing), no content recorded.
- `npm run check` PASS: 129 unit, 20 integration, 13 E2E.
- Commit `363ea0a`. Report: `docs/phase4/TASK1_DOM_AUDIT.md`.
- Stopped after Task 1; Task 2 awaits explicit approval. No writes, no MCP.
- Documentation commit follows; check `git log -1`.

## 2026-11-10 — Phase 3 multi-account implementation

- Phase 2 closed for MVP (`8126928`) with accepted deferred verifications.
- Phase 3 plan committed (`51d4ccc`).
- Phase 3 implementation committed (`d1107bc`):
  - `AccountStore`: list/get/rename, atomic writes, label validation,
    managed-profile-path validation, corrupt-registry backup + empty recovery.
  - `AccountController`: fixed `accountId`, no account creation/removal; proxy,
    retry, and browser preservation preserved.
  - `AccountManager`: lazy per-account runtimes, max 3 active browsers,
    `BROWSER_LIMIT_REACHED`, per-account serialization, view isolation, remove
    with explicit profile deletion, shutdown.
  - IPC/preload/renderer: 11 channels with account ids; multi-account dashboard
    with Add/Rename/Connect/Open/Disconnect/Remove; global manual proxy card.
  - Tests: three accounts, isolation, lazy launch, max limit, concurrent start,
    remove, corrupt recovery, path traversal, multi-account E2E.
- Verification: `npm run check` PASS — 117 unit, 13 integration, 13 E2E, build,
  typecheck, lint, format.
- Remaining: live three-real-account isolation test and
  `docs/phase3/PHASE3_REPORT.md`. Phase 4 not started.
- Documentation commit follows; check `git log -1`.

## 2026-11-10 — Phase 4 Task 2: queue + read-only helpers

- Added `AccountActionQueue` (one per account; sequential per account, parallel
  across accounts; timeout; error recovery; browser-closed handling; no global
  queue).
- Added `TelegramReadAdapter`: listChats, searchChats, getChatListState,
  getOpenChatInfo, openChat (explicit), readVisibleMessages, getMessageMetadata,
  getMessageCount, classifyMessageDirection.
- Bounded output; no write operations. Lists/search never open chats; openChat
  may mark read and is explicit only.
- Added `getPage` on controller/manager, `CHAT_NOT_FOUND`, fixtures and tests.
  Refined chat-list loading so a message-area preloader does not mask a ready
  list.
- Tests: `npm run check` PASS — 134 unit, 31 integration, 13 E2E.
- Real read-only smoke: `moein1` 11 rows / 5 search results; `kaonashi` 12 rows
  / 1 search result. No chat opened because all visible chats had unread badges;
  message helpers are fixture-tested. No content logged.
- Commit `b7eae50`. Report: `docs/phase4/TASK2_READ_ADAPTER.md`.
- Stopped after Task 2; Task 3 awaits explicit approval. No writes, no MCP.
- Documentation commit follows; check `git log -1`.

## 2026-11-11 — Phase 4 Task 2 verification after ACCOUNT_QUOTA

- Resumed after the previous session stopped on ACCOUNT_QUOTA. Checked the real
  repository state first: Task 2 code and tests were already committed as
  `b7eae50`; only documentation was uncommitted.
- Re-ran `npm run check` (2026-11-11) — exit 0: typecheck, lint, format PASS;
  21 unit files / 134 tests PASS; 4 integration files / 31 tests PASS;
  13 Electron E2E PASS; build PASS.
- No test was deleted, skipped, or rewritten; no product code changed.
- Added `docs/phase4/PHASE4_REPORT.md` (phase-level report, in-progress status)
  and fixed a stale TASKS/05 line that still said operations belong to Tasks 2–4.
- Did not repeat the live smoke: the previous session's sanitized result is
  recorded and no raw log exists by design. Live message read remains untested.
- No account, profile, or session was opened, deleted, reset, or logged out in
  this session. No message was sent, edited, deleted, forwarded, or reacted to.
- Documentation commit follows; check `git log -1`. Task 3 awaits approval.

## 2026-11-14 — Phase 4 Task 3 agent-ready reads

- Branch main, implementation commit ce55b75. Clean working tree at the
  implementation checkpoint before this handoff update.
- Reused the Task 1–2 probes and adapter. Finished bounded TelegramService,
  recipient resolution, UI health, queue timeout isolation, IPC, preload and
  per-account diagnostics. See LATEST_HANDOFF.md and git show --name-only
  ce55b75 for changed files.
- npm run check PASS. Typecheck, lint, format and build passed. Unit 164,
  Chromium integration 33, Electron E2E 14.
- Real profiles were untouched. Current WebZ markup and search timing remain
  unverified live. First next action is Task 4 controlled live validation after
  explicit approval. Task 3 is complete.

## 2026-11-14 — Phase 4 Task 4 confirmed Telegram messaging

- main was clean at 8c2fc1b. Implementation 08e313a and test checkpoint 9bbf031
  completed; working tree clean before this handoff.
- Added Main message preparation and native approval, shared queue composer
  submission, outgoing/reply verification, explicit IPC and renderer controls.
  Exact paths are in LATEST_HANDOFF.md and git show --name-only 08e313a 9bbf031.
- npm run check passed. Baseline 164 unit, 33 integration, 14 E2E. Final 173
  unit, 39 integration, 15 E2E plus typecheck, lint, formatting and build.
- Real profiles untouched. Live smoke is pending approval of exact account,
  destination, text and target. Next action is one controlled Saved Messages
  send after approval, followed by a separately approved reply.

## 2026-11-14 — Saved Messages recipient regression

- Branch main, fix 7a4b147. Working tree clean after the fix commit.
- Search adapter, resolver, DTO, native and renderer previews, and regression
  tests updated. See git show --name-only 7a4b147 for the full file list.
- npm run check passed: 174 unit, 41 integration, 15 E2E, plus typecheck,
  lint, formatting and build.
- Chromium window binding failed. Deployed DOM remains unverified.
  No real message sent. Next action is the read-only deployed DOM audit.

## 2026-11-14 — Search focus and recent results

- Branch main, baseline e515eb3. The commit containing this entry adds query
  focus/value checks and excludes recent rows in readiness and extraction.
- Changed the read adapter, selector map, Chromium regression test and docs.
- npm run check passed: 174 unit, 42 integration, 15 E2E and build checks.
- Live verification on the rebuilt app is next. No real message was sent.

## 2026-11-14 — Confirmed search result navigation

- Main baseline 6108dcc. Updated messaging preparation, service and adapter,
  the Chromium regression and docs. Confirmed Send can open search-only peers.
- npm run check passed: 174 unit, 43 integration, 15 E2E. Live send pending.

## 2026-11-14 — Final Send guard

- Main baseline e7c7ce4. Updated composer, selector map, fixture tests and docs.
- npm run check passed: 174 unit, 45 integration and 15 E2E plus build checks.
- Exact live failure remains unverified. Restart and inspect the staged draft
  before the next manual send test. No real message was sent in this checkpoint.

## 2026-11-14 — Existing composer draft

- Main baseline 3b0a186. Composer, Chromium fixture and status docs updated.
- npm run check passed: 174 unit, 46 integration and 15 E2E plus build checks.
- Next: restart and repeat the manually approved Saved Messages test.

## 2026-11-14 — Stars badge and ephemeral-state guard

- Main baseline b11ea72. Composer, selectors, Chromium regressions and status
  docs changed. Live error identified the paid/ephemeral pre-click check.
- npm run check passed: 174 unit, 49 integration, 15 E2E plus build checks.
- Live send remains pending. No real message was sent during this checkpoint.
