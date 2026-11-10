# Latest Handoff

## Project
Telegram Agent Connector

## Current Phase
Phase 2 — Browser Manager, Proxy, Single Account Login.
Status: **Partially Verified**. Automated work is complete; live QR/2FA/session
checks are pending the user.

## Current Task
Saved-proxy application fix — complete and committed (`51714cf`). Remaining: the
user must enable the proxy once more in the UI and run the live checklist in
`docs/phase2/PHASE2_REPORT.md` §8.

## Overall Status
Partially Verified — not complete. Phase 3 must not start.

## Last Verified Commit
`51714cf` `fix(proxy): persist enable toggle and apply saved proxy to browser`
passed full `npm run check`. The documentation commit containing this handoff is
the latest commit on `main` (check `git log -1`).

## Git Branch
main

## Working Tree
Documentation updates for the saved-proxy fix: this handoff, `SESSION_LOG.md`,
`PROJECT_STATE.md`, `RESUME_PROMPT.md`, `ARCHITECTURE_DECISIONS.md` (ADR-020
update), `docs/architecture/IMPLEMENTED_ARCHITECTURE.md`,
`docs/phase2/PHASE2_REPORT.md`, and `AGENTS.md` (settings/storage consistency
rule). No product code is uncommitted.

## Completed Work

- Phase 0 — feasibility spike, real QR/2FA/session evidence (`4219476`,
  `8e25b57`).
- Phase 1 — secure Electron foundation (`619c095`).
- Phase 2 Tasks 1–7 — profile paths/lock, BrowserManager + Playwright, Telegram
  selectors/login monitor, account store/controller, IPC/preload/dashboard
  (`22789a8`–`07f20d9`).
- Task 8 — governance (`0ac40fe`), architecture audit (`9c2d0d2`), automated
  verification (`582c01a`, `9d5065a`, `378f294`).
- Manual proxy configuration (`67cb669`): removed system-proxy detection, added
  manual SOCKS5/HTTP settings, persistence, real Test Proxy, safeStorage
  credentials, proxy UI, browser preservation on navigation errors.
- Saved-proxy fix (`51714cf`):
  - Root cause found in the real data: `%LOCALAPPDATA%\UnofficialTelegram
    AgentConnector\config\proxy.json` contained `"enabled": false` while the
    form looked enabled. The controller → `toPlaywrightProxyConfig` →
    `launchPersistentContext` path was correct; the flag was not persisted.
  - The UI persisted only on explicit Save, and the asynchronous initial
    settings read could overwrite a toggle made before it resolved.
  - Fix: Enable toggling persists immediately; initial load cannot overwrite
    touched form state; the controller logs the actual stored proxy metadata
    (`proxy.enabled`, protocol, host, port, mode — never credentials);
    fail-closed if enabled but unusable; BrowserManager logs `context closed`.
  - `safeStorage` migrated to the async API (`isAsyncEncryptionAvailable`,
    `encryptStringAsync`, `decryptStringAsync`); the deprecation warning is gone.
  - New tests: UI toggle auto-persistence, saved settings → Playwright →
    persistent Chromium, proxy log metadata, fail-closed.

## Test Results (2026-11-10, commit `51714cf`)

Environment:

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"
npm run check
```

- `npm run check` — PASS (exit 0).
- Typecheck — PASS; Lint — PASS; Format — PASS.
- Unit — 18 files / 108 tests PASS.
- Integration — 2 files / 13 tests PASS (real Chromium).
- Build — PASS.
- Electron E2E — 1 file / 11 tests PASS with `ELECTRON_RUN_AS_NODE=1` exported
  (the launcher strips it).
- No `safeStorage` deprecation warning in the E2E run.

Real environment evidence (from `67cb669`, still valid):

- `probeProxy` reached `web.telegram.org:443` through
  `socks5://127.0.0.1:10808`, `socks5://127.0.0.1:12334`, and
  `http://127.0.0.1:10808`.
- Chromium loaded `https://web.telegram.org/k/` with HTTP 200 through
  `socks5://127.0.0.1:10808`.

## Architecture Decisions

- ADR-020 — Manual Proxy Configuration (supersedes ADR-013 and ADR-018);
  updated with the saved-proxy fix.
- ADR-021 — Keep browser/profile/session after navigation errors; retry in
  place; relaunch only on proxy change or closed page.
- ADR-019 — E2E loads Playwright via `process.mainModule.require`; test-only,
  deprecated API.
- D-006 is Manual Proxy Configuration in `PROJECT_STATE.md`.

## Environment Facts

- The existing `%LOCALAPPDATA%\UnofficialTelegramAgentConnector\config\proxy.json`
  on this machine still has `"enabled": false` from the failed attempt. The user
  must enable the proxy once more in the UI; with `51714cf` it is saved at once.
- `ELECTRON_RUN_AS_NODE=1` is exported by the DSH shell only (not User/Machine).
  `npm run check` strips it for E2E; `npm run dev` in that shell must unset it.
- `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers` is development/test only; product
  code does not read it and Phase 6 must bundle Chromium.
- V2RayN (`127.0.0.1:10808`) and Hiddify (`127.0.0.1:12334`) are available on
  this machine; neither is hardcoded in the app.

## Known Issues

- Live QR/2FA/session/restart and in-app proxy-loss behavior are Pending.
- `BROWSER_CLOSED` appears only when the Chromium context really closes; it is
  not emitted for a navigation error. The browser-manager now logs
  `context closed` when this happens (e.g., the user closes the window or the
  app quits).
- SOCKS5 authentication through Chromium/Playwright is unverified; the probe
  supports it and HTTP auth is tested with Chromium.
- A proxy change applies on the next connection; while connected, the user must
  Disconnect, save, then Connect.
- The account view starts empty after an app restart; the stored account is
  reused on connect but the button still says "Add Account".
- Page crash is logged; it does not close the context.
- Chromium is not bundled until Phase 6.
- No multi-account queue, permissions, audit logger, MCP, or tray yet.

## Blockers
Automated work is not blocked. The live checklist needs the user and a real
Telegram account.

## Remaining Work

1. User runs the 16-step checklist in `docs/phase2/PHASE2_REPORT.md` §8 using
   SOCKS5 `127.0.0.1:10808` (and Hiddify on 12334).
2. Verify the console prints:
   `starting browser`, `proxy.enabled=true`, `proxy.protocol=socks5`,
   `proxy.host=127.0.0.1`, `proxy.port=10808`, `mode=proxy` — and **not**
   `mode=direct`.
3. Record actual results in this handoff, update `PROJECT_STATE.md` and
   `SESSION_LOG.md`, and commit the documentation.
4. Only then decide whether Phase 2 can be marked Complete.
5. Do not start Phase 3 without explicit approval.

## Exact Next Action
Ask the user to run `npm run dev` (after unsetting `ELECTRON_RUN_AS_NODE` in that
shell and setting `PLAYWRIGHT_BROWSERS_PATH=spike/.browsers`), open
Network/Proxy, enable the proxy (it now saves immediately), confirm
`config/proxy.json` shows `"enabled": true`, then click Add Account and check the
console lines above. No code change is pending. Do not perform the live login on
the user's behalf.

## Resume Instructions
Read `AGENTS.md`, `docs/PROJECT_STATE.md`, this file,
`docs/handoff/SESSION_LOG.md`, `docs/handoff/RESUME_PROMPT.md`,
`docs/architecture/IMPLEMENTED_ARCHITECTURE.md`, and
`docs/phase2/PHASE2_REPORT.md`. Check `git status`, `git log --oneline -12`, and
`git diff`. All Phase 2 code is committed; the only open work is the live
checklist and the completion decision.
