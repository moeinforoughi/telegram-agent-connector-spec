# Resume Prompt

You are starting a new session with **no memory of previous chats**. The
repository is the only source of truth.

Before changing anything:

1. Read `AGENTS.md` (including the permanent Session-Independent Development
   rules).
2. Read `docs/PROJECT_STATE.md`.
3. Read `docs/handoff/LATEST_HANDOFF.md`.
4. Skim `docs/handoff/SESSION_LOG.md` (append-only history).
5. Read `docs/architecture/IMPLEMENTED_ARCHITECTURE.md` (what is really built)
   and `docs/phase2/PHASE2_REPORT.md` (verification status and the pending live
   checklist).
6. Read the active plan (`docs/phase2/PHASE2_PLAN.md` while Phase 2 is active)
   and the task files it references.
7. Inspect the real repository state:
   `git status`, `git branch --show-current`,
   `git log --graph --oneline --decorate -20`, `git diff`,
   `git ls-files --others --exclude-standard`.
8. Compare the working tree and commits with the last handoff. If they differ,
   investigate before deleting or overwriting anything.
9. Do not reimplement committed work. Check the source and tests first.
10. Keep the state files updated at every logical checkpoint; before stopping,
    run the available tests and record the exact commands and results.
11. Do not start a later phase without explicit user approval.
12. Do not push, reset, or delete user changes.
13. Never keep an important decision, limitation, or test result only in chat.
    Put it in the repository.

## Current state (2026-11-10)

Phase 2 is **Partially Verified**: real Telegram login and browser-restart
session persistence PASS (successful proxy: SOCKS5 `127.0.0.1:12334`). Electron
full restart, Windows restart, proxy loss/recovery, and session revoke detection
are still Pending; QR-vs-phone and 2FA were not recorded. Tasks 1–8 and both
proxy fixes (`67cb669`, `51714cf`) are committed. Phase 3 is not authorized.

Do not ask the user to repeat real login or browser close/reopen; those are
already PASS. See `docs/phase2/PHASE2_REPORT.md` §3.1 and §8.

Proxy rules (permanent): the connector uses only the user's saved manual proxy
(SOCKS5/HTTP, host, port, optional credentials). There is no system-proxy
detection and no silent fallback. The Enable toggle persists immediately; the
controller logs the stored proxy metadata (never credentials) and fails closed
if enabled but unusable. Credentials are OS-encrypted (async safeStorage) or not
stored. Do not reintroduce `windows-proxy`-style detection; see ADR-020/021.

## Test commands

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"   # local Chromium for integration tests
npm run check
```

`npm run check` strips `ELECTRON_RUN_AS_NODE` for its Electron E2E child
process, so it passes even when the DSH shell exports `ELECTRON_RUN_AS_NODE=1`.
For interactive `npm run dev` / `npm start`, unset it in that shell first
(`Remove-Item Env:ELECTRON_RUN_AS_NODE`), otherwise Electron boots as plain Node
and fails with `bad option: --remote-debugging-port=0`. Never change the
Windows User/Machine environment for this.

If the environment differs (no portable Node, no browsers), record the
limitation instead of skipping tests silently.
