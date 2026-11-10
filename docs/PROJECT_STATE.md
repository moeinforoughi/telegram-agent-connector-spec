# Project State — Telegram Agent Connector

Last updated: 2026-11-10 (saved-proxy application fixed; live QR pending)

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
  Telegram login detector/monitor, account store/controller, account IPC, and a
  single-account dashboard.
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
| 2 — Browser Manager, proxy, single account login | **Partially Verified** — automated green, live manual pending | `docs/phase2/PHASE2_PLAN.md`, `docs/phase2/PHASE2_REPORT.md`; Tasks 1–8 committed |
| 3+ | Not started; no approval | Roadmap docs |

## Active Task

Phase 2 final proxy fix — implementation and automated verification are complete
(`67cb669`). The live checklist in `docs/phase2/PHASE2_REPORT.md` §8 is
**Pending**: the user must set the proxy in the UI (default SOCKS5
`127.0.0.1:10808`), run Test Proxy, connect, complete QR/2FA, and verify
restart/session/proxy-loss behavior. Phase 2 stays "Partially Verified" until
those steps are recorded. Do not start Phase 3.

## Session-Independent Development

Permanent rule recorded in `AGENTS.md`: development state must live in the
repository, never only in an agent's memory or the current chat. Every session
starts by reading `AGENTS.md`, this file, `docs/handoff/LATEST_HANDOFF.md`, the
active task, and by inspecting Git and the working tree. Every logical
checkpoint updates the handoff files. When chat, docs, and code disagree, Git,
code, and test evidence win.

## Approved Decisions

- D-001: WebZ `https://web.telegram.org/k/` only; selectors centralized;
  login detection uses visibility.
- D-002: Named Pipe ACL — open, Phase 5.
- D-003: pinned stack above.
- D-004: AI content processing — blocked.
- D-005: Windows 10 support — open; target is Windows 11 x64.
- D-006 (revised 2026-11-10): **Manual Proxy Configuration**. The only proxy
  source is the user's settings: protocol (SOCKS5/HTTP), host, port, optional
  username/password. System-proxy auto-detection, environment fallback, vendor
  presets, OS network changes, and silent fallback are removed. Credentials are
  encrypted with OS secure storage or not persisted. Implemented in Phase 2
  (ADR-020).
- ADR-012/013/014 in `ARCHITECTURE_DECISIONS.md`.

## Verified Facts and Limits

- Phase 0 proved headed Chromium, WebZ `/k/`, real QR login, manual 2FA,
  session survival after browser/Node restart, chat-list reading, single-profile
  lock, clean close, no secrets in logs.
- Phase 0 used an **explicit** local HTTP proxy via `SPIKE_PROXY`; automatic
  system-proxy inheritance was never proven. In the final Phase 2 proxy fix the
  system-proxy detector was removed entirely: only manual settings are used.
- Phase 1 hardened Electron (context isolation, sandbox, no node integration,
  allowlisted IPC, sender validation, strict production CSP, permission denial,
  navigation/window blocking).
- Phase 2 Tasks 1–7 are committed: `22789a8`, `b644d43`, `99da896`, `3e67eab`,
  `713eb0d`, `cce43eb`, `07f20d9`. They add profile paths/lock, BrowserManager +
  Playwright launcher, Telegram selector map and login monitor, account
  store/controller, and the account IPC/preload/renderer wiring. The original
  system-proxy resolver (`b644d43`) was superseded and removed by `67cb669`.
- Task 7 removed the abandoned untracked `src/main/browser-self-test.ts` (dead
  code, imported a non-existent type, referenced by nothing). The E2E
  Playwright-in-main test now loads Playwright through
  `process.mainModule.require(<appPath>/node_modules/playwright)` because
  `app.evaluate` has no dynamic-import callback.
- Full verification at Task 8 (2026-11-10, commit `582c01a`): `npm run check`
  passed with `ELECTRON_RUN_AS_NODE=1` still exported — typecheck, lint,
  format:check, 103 unit tests, 11 integration tests (real Chromium), build, and
  8 E2E tests. Task 8 added stale-lock profile recovery, proxy-loss/recovery,
  and E2E environment sanitization.
- Final proxy fix (2026-11-10, commit `67cb669`): manual Network/Proxy UI with
  SOCKS5/HTTP, real Test Proxy tunnel, `proxy.json` persistence, safeStorage
  credential encryption, removal of system-proxy code, and browser preservation
  on navigation errors.
- Saved-proxy fix (2026-11-10, commit `51714cf`): the real `proxy.json` had
  `enabled:false` while the form looked enabled. The controller/Playwright path
  was correct; the UI persisted only on Save and could lose a toggle to the
  initial async load. Enable now persists immediately, the initial load cannot
  overwrite edits, the controller logs the actual proxy metadata (no
  credentials), and start is fail-closed when the proxy is enabled but unusable.
  `safeStorage` moved to the async API. `npm run check` passes: 108 unit, 13
  integration, 11 E2E, build, typecheck, lint, format.
- Real environment evidence (2026-11-10): the probe reached
  `web.telegram.org:443` through both local proxies (`127.0.0.1:10808` and
  `127.0.0.1:12334`), and Chromium loaded `https://web.telegram.org/k/` with
  HTTP 200 through `socks5://127.0.0.1:10808`. QR/2FA is still Pending.
- The account renderer never receives profile paths or credentials;
  `AccountView` carries status metadata only. Proxy credentials never reach the
  renderer (`hasPassword` only) and are never stored in plain text.
- Playwright browsers for the root package are not in the default cache; the
  Phase 0 download lives in gitignored `spike/.browsers` (Chromium revision 1254,
  matching Playwright 1.65.0). Use `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers` for
  local integration/E2E tests. Phase 6 must bundle Chromium.
- The DSH shell exports `ELECTRON_RUN_AS_NODE=1`. With it set, Electron boots as
  Node and Playwright's Electron launch fails with
  `bad option: --remote-debugging-port=0`. The E2E launcher now strips it from
  the child environment, so `npm run check` works regardless; `npm run dev` in
  that shell still needs it unset. No Windows environment change is made.
- Live QR/2FA/session-restart/Electron-restart/proxy operations are **Pending**
  and require the user; see `docs/phase2/PHASE2_REPORT.md` §8. Phase 2 is
  therefore Partially Verified, not complete.

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
| `7c51c03` | Reconcile handoff with the real repository state |
| `07f20d9` | Account IPC, preload bridge and single-account dashboard |
| `0ac40fe` | Permanent session-independent development rules |
| `9c2d0d2` | Implemented architecture audit and ADR-015…019 |
| `582c01a` | Task 8 automated verification tests |
| `67cb669` | Manual proxy configuration, secure credentials, browser preservation |
| `51714cf` | Persist the Enable toggle and apply the saved proxy to Chromium |

## Key Documents

- `AGENTS.md` — permanent engineering rules, including session independence.
- `ARCHITECTURE.md`, `ARCHITECTURE_DECISIONS.md` (ADR-020 manual proxy,
  ADR-021 browser preservation), `SECURITY_THREAT_MODEL.md`.
- `docs/architecture/IMPLEMENTED_ARCHITECTURE.md` — architecture actually
  implemented through Phase 2 Task 8, with divergences and limits.
- `docs/phase2/PHASE2_REPORT.md` — final Phase 2 verification and the pending
  live checklist.
- `TASKS/00_DISCOVERY_AND_SPIKE.md`, `TASKS/01_REPO_FOUNDATION.md`,
  `TASKS/02_DESKTOP_SHELL.md`, `TASKS/03_BROWSER_LOGIN_SESSION.md`.
- `docs/handoff/` — cross-session state.
- `docs/phase2/PHASE2_PLAN.md` — active plan.
