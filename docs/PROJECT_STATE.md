# Project State — Telegram Agent Connector

Last updated: 2026-11-10 (Phase 2, Task 7 in progress)

## Project Goal

Local Windows desktop connector that lets a user connect real Telegram accounts
through the visible Telegram Web UI, without `api_id`, `api_hash`, Bot Token,
MTProto, Telethon, or GramJS, and later expose limited tools to agents over a
local MCP server.

Product name must keep the word **Unofficial**; no official Telegram logo or
implied affiliation.

## Current Architecture

- Modular monolith: Electron Main owns Core and the Browser Manager.
- Renderer is UI only; Preload exposes a small validated API.
- Phase 2 adds: BrowserManager (Playwright persistent context), proxy resolver,
  Telegram login detector/monitor, account store/controller, and account IPC.
- MCP Server and Named Pipe bridge are future phases.
- One browser context per profile; account operations serialized.
- Browsers are lazy-started; the app does not open every account at launch.

## Technology Stack

| Technology | Version | Notes |
|---|---|---|
| Node.js (tooling) | 26.13.0 LTS | build, tests, npm |
| Electron | 45.2.3 | Main/Preload runtime |
| Electron embedded Node | 24.22.2 | actual Main runtime |
| Electron Chromium | 156.0.8078.80 | app UI only |
| Playwright | 1.65.0 | Browser Manager (runtime dependency) |
| Chrome for Testing | 158.0.8127.18 (rev 1254) | Telegram browser |
| React | 19.3.1 | renderer |
| TypeScript | 5.9.3 | strict |
| Vite / electron-vite | 8.3.7 / 6.0.0 | build |
| Vitest | 5.1.0 | unit/integration/E2E runner |
| MCP TypeScript SDK | 1.32.2 | Phase 5 |
| Zod | 4.6.7 | Phase 4/5 validation |

## Phases

| Phase | Status | Evidence |
|---|---|---|
| 0 — Feasibility spike | Complete, GO with conditions | `docs/spike/PHASE0_REPORT.md`, `spike/logs/spike-state.jsonl` |
| 1 — Repository foundation | Complete | `docs/phase1/PHASE1_REPORT.md`, commit `619c095` |
| 2 — Browser Manager, proxy, single account login | In progress | `docs/phase2/PHASE2_PLAN.md`; tasks 1–6 committed, task 7 uncommitted |
| 3+ | Not started; no approval | Roadmap docs |

## Active Task

Phase 2, Task 7 — IPC, preload and renderer. The wiring exists in the working
tree but is not verified or committed. See `docs/handoff/LATEST_HANDOFF.md`.

## Approved Decisions

- D-001: WebZ `https://web.telegram.org/k/` only; selectors centralized;
  login detection uses visibility.
- D-002: Named Pipe ACL — open, Phase 5.
- D-003: pinned stack above.
- D-004: AI content processing — blocked.
- D-005: Windows 10 support — open; target is Windows 11 x64.
- D-006: **System Proxy First + Manual Fallback**; no hardcoded proxy, no port
  scanning, no OS proxy changes, no proxy credentials in logs. Implemented in
  Phase 2.
- ADR-012/013/014 in `ARCHITECTURE_DECISIONS.md`.

## Verified Facts and Limits

- Phase 0 proved headed Chromium, WebZ `/k/`, real QR login, manual 2FA,
  session survival after browser/Node restart, chat-list reading, single-profile
  lock, clean close, no secrets in logs.
- Phase 0 used an **explicit** local HTTP proxy via `SPIKE_PROXY`; automatic
  system-proxy inheritance was not proven. At Phase 2 start, Windows
  `ProxyEnable` was `0` on the development machine and no proxy env vars were
  set. Treat system-proxy inheritance as unproven until a live test.
- Phase 1 hardened Electron (context isolation, sandbox, no node integration,
  allowlisted IPC, sender validation, strict production CSP, permission denial,
  navigation/window blocking).
- Phase 2 Tasks 1–6 are committed: `22789a8`, `b644d43`, `99da896`, `3e67eab`,
  `713eb0d`, `cce43eb`. They add the proxy resolver, profile paths/lock,
  BrowserManager + Playwright launcher, Telegram selector map and login
  monitor, and the account store/controller.
- Task 7 wiring (account IPC channels, preload bridge, single-account dashboard)
  exists only in the working tree. It is not committed.
- Test status at this checkpoint (2026-11-10):
  - Unit: 103/103 pass (`npx vitest run tests/unit`).
  - Integration: 9/9 pass with real Chromium (`npx vitest run tests/integration`).
  - E2E: 7/8 pass; `loads Playwright and launches a browser from the Electron
    main process` fails because dynamic `import()` is unavailable inside
    Playwright's `app.evaluate`.
  - `npx tsc --noEmit` fails on the untracked `src/main/browser-self-test.ts`,
    which imports a non-existent `BrowserSelfTestResult` from `src/shared/ipc`.
    Nothing imports that file.
  - `npx eslint .` fails on one type-import annotation in `tests/e2e/app.test.ts`.
  - `npx prettier --check .` reports three unformatted files.
- Playwright browsers for the root package are not in the default cache; the
  Phase 0 download lives in gitignored `spike/.browsers` (Chromium 1254). Use
  `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers` for local integration/E2E tests.
- The DSH shell exports `ELECTRON_RUN_AS_NODE=1`. With it set, Playwright's
  Electron launch fails with `bad option: --remote-debugging-port=0`. Unset it
  (for example `Remove-Item Env:ELECTRON_RUN_AS_NODE`) before E2E runs; this is
  an environment artifact, not an application bug.

## Important Commits

| Commit | Meaning |
|---|---|
| `4219476` | Phase 0 feasibility docs |
| `8e25b57` | Phase 0 2FA and proxy evidence |
| `619c095` | Phase 1 Electron foundation |
| `22789a8` | Phase 2 state files and plan |
| `b644d43` | Proxy resolver and Windows proxy reader |
| `99da896` | Account profile paths and lock |
| `3e67eab` | BrowserManager, Playwright launcher, integration tests |
| `713eb0d` | Telegram selectors, login detector and monitor |
| `cce43eb` | Account store and controller |

## Key Documents

- `AGENTS.md` — permanent engineering rules.
- `ARCHITECTURE.md`, `ARCHITECTURE_DECISIONS.md`, `SECURITY_THREAT_MODEL.md`.
- `TASKS/00_DISCOVERY_AND_SPIKE.md`, `TASKS/01_REPO_FOUNDATION.md`,
  `TASKS/02_DESKTOP_SHELL.md`, `TASKS/03_BROWSER_LOGIN_SESSION.md`.
- `docs/handoff/` — cross-session state.
- `docs/phase2/PHASE2_PLAN.md` — active plan.
